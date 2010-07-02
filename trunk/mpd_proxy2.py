#!/usr/bin/env python
#
#       mpd_proxy2.py
#
#       Copyright 2009 Chris Seickel
#
#       This program is free software; you can redistribute it and/or modify
#       it under the terms of the GNU General Public License as published by
#       the Free Software Foundation; either version 2 of the License, or
#       (at your option) any later version.
#
#       This program is distributed in the hope that it will be useful,
#       but WITHOUT ANY WARRANTY; without even the implied warranty of
#       MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#       GNU General Public License for more details.
#
#       You should have received a copy of the GNU General Public License
#       along with this program; if not, write to the Free Software
#       Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston,
#       MA 02110-1301, USA.

from mpd import MPDClient, ConnectionError, MPDError
from datetime import datetime
from time import sleep
import threading, re, os, socket
from copy import deepcopy
import sys, traceback

_Instance = None
_Poller = None



def Mpd(host, port, password):
    global _Instance
    if _Instance is None:
        _Instance = _Mpd_Instance(host, port, password)
        _Poller = _Mpd_Poller(host, port, password)
        _Poller.setDaemon(True)
        _Poller.start()
    return _Instance



class _MpdPlaylist(list):

    def __init__(self):
        self.version = -1
        self.files = None

    def getByFile(self, fpath):
        if self.files is None:
            self.files = dict(( (x['file'], int(x['pos'])-1) for x in self ))
        index = self.files.get(fpath, None)
        if index is None:
            return None
        else:
            return self[index]

    def update(self, changes, new_length):
        self.files = None
        old_length = len(self)
        if new_length >= old_length:
            for x in range(new_length - old_length):
                self.append(None)
        else:
            del self[new_length:]
        for change in changes:
            p = int(change['pos'])
            change['pos'] = p + 1
            change['type'] = 'file'
            change['ptime'] = hmsFromSeconds(change.get('time', 0))
            if not change.get('title'):
                change['title'] = change['file'].rsplit('/', 1)[-1]
            self[p] = change



class _Mpd_Poller(threading.Thread):
    """
    A simplified version of the _MPD_Instance which does nothing but
    run the idle command and force a status sync when needed.  This
    replaces the need to poll mpd on a timer.
    """
    
    def __init__(self, host, port, password):
        threading.Thread.__init__(self)
        self._host = host
        self._port = port
        self._password = password
        self.con = None


    def _connect(self):
        try:
            if self.con:
                self.con.disconnect()
            else:
                self.con = MPDClient()
        except:
            self.con = MPDClient()

        self.con.connect(self._host, self._port)
        if self._password:
            self.con.password(self._password)
            
    
    def run(self):
        global _Instance
        self._connect()
        _Instance.sync(['startup'])
        while True:
            try:
                changes = self.con.idle()
                _Instance.sync(changes)
            except (ConnectionError, socket.error), e:
                print "%s\n    reconnecting..." % e
                self._connect()
                _Instance.sync(['startup'])
        print "Exiting MPD Poller..."
                
                

class _Mpd_Instance:
    """
    Creates a singleton mpd instance where connection issues are handled
    automatically.

    This proxy class adds a state object and a sync method.
    Rather than calling to status, stats, and currentsong separately,
    call sync() periodically and read the results from the mpd.state dict
    which merges the output of all of these commands.

    Also added is a playlist object which is kept updated by the sync()
    method.
    """

    def __init__(self, host, port, password):
        self._host = host
        self._port = port
        self._password = password
        self._in_list = False
        self.con = None
        self.state = {'db_update': 0, 'playlist': 0, 'playlistname': 'Untitled'}
        self.lastcheck = datetime.utcnow()
        self.state['playlists'] = self.lastcheck.ctime()
        self.playlist = _MpdPlaylist()
        self._dbcache = {}
        self._cache_cmds = ('list', 'lsinfo', 'find', 'search', 'playlistinfo')
        self.lock = threading.RLock()
        self._connect()


    def __getattr__(self, name):
        if name == 'list':
            return self.list
        elif name == 'listplaylists':
            return self.listplaylists
        elif name == 'load':
            return self.load
        elif name == 'playlistinfo':
            return lambda: self.playlist[:]
        elif name == 'save':
            return self.save
        elif name == 'raw':
            return self.raw
        else:
            fn = self.con.__getattr__(name)

        if name in ('lsinfo', 'find', 'search', 'playlistinfo', 'listplaylistinfo'):
            return lambda *args: self._extendDbResult(self._safe_cmd(fn, args))
        return lambda *args: self._safe_cmd(fn, args)


    def _connect(self):
        try:
            if self.con:
                self.con.disconnect()
            else:
                self.con = MPDClient()
        except:
            self.con = MPDClient()

        try:
            self.con.connect(self._host, self._port)
        except ConnectionError, e:
            print e
            print "Retrying connection in 3 seconds..."
            sleep(3.0)
            self.con.connect(self._host, self._port)
            
        if self._password:
            self.con.password(self._password)


    def _extendDbResult(self, data):
        for item in data:
            keys = item.keys()
            if 'file' in keys:
                p = item.get('pos')
                if p is None:
                    item['id'] = "file:" + item['file']
                else:
                    item['pos'] = int(p) + 1
                item['type'] = 'file'
                item['ptime'] = hmsFromSeconds(item.get('time', 0))
                if not item.get('title'):
                    item['title'] = item['file'].rsplit('/', 1)[-1]
            elif 'directory' in keys:
                item['type'] = 'directory'
                item['title'] = item['directory'].split('/')[-1]
                item['id'] = "directory:" + item['directory']
            elif 'playlist' in keys:
                item['type'] = 'playlist'
                item['title'] = item['playlist']
                item['id'] = "playlist:" + item['playlist']
            else:
                item['type'] = keys[0]
                item['title'] = item[keys[0]]
                item['id'] = keys[0] + ":" + item[keys[0]]
                
        return data


    def _safe_cmd(self, fn, args):
        try:
            self.lock.acquire()
            return fn(*args)
        except (ConnectionError, socket.error), e:
            print "%s\n    reconnecting..." % e
            self._connect()
            return fn(*args)
        finally:
            self.lock.release()
        
        
    def clear_cache(self):
        self._dbcache = {}
        
        
    def command_list_ok_begin(self):
        self._in_list = True
        self._safe_cmd(self.con.command_list_ok_begin, ())


    def command_list_end(self):
        self._safe_cmd(self.con.command_list_end, ())
        self._in_list = False


    def crop(self, id=None):
        if id is None:
            pos = int(self.state['song'])
            id = self.playlist[pos]['id']

        self.command_list_ok_begin()
        for item in self.playlist:
            if item['id'] <> id:
                self.deleteid(item['id'])
        self.command_list_end()


    def execute(self, command):
        """
        Execute an MPD Telnet command.
        command: Either a string, tuple, or list representing a single
                complete command.  A string should be in the same format
                as the command would be in a telnet session.

        Examples:
        command = 'list album artist "David Bowie"'
        command = ('list', 'album', 'artist', 'David Bowie')
        command = ['list', 'album', 'artist', 'David Bowie']
        """

        xstart = datetime.utcnow()
        if isinstance(command, str) or isinstance(command, unicode):
            cached = self._dbcache.get(command)
            if cached is not None:
                return cached

            term = re.search('\s\"(.+)\"', command)
            if term:
                cmdlist = command[:term.start(0)].split(" ")
                cmdlist.append(term.group(1))
            else:
                cmdlist = command.split(" ")
        else:
            cached = self._dbcache.get(' '.join(command))
            if cached is not None:
                return cached

            if isinstance(command, tuple):
                cmdlist = list(command)
            elif isinstance(command, list):
                cmdlist = command.copy()
            else:
                cmdlist = list(command)
        cmd = cmdlist.pop(0)

        result = self.__getattr__(cmd)(*cmdlist)
        if cmd in self._cache_cmds:
            self._dbcache[command] = result
            
        diff = datetime.utcnow() - xstart
        ms = (diff.seconds * 1000) + (diff.microseconds / 1000)
        print "%d ms to run command: %s" % (ms, command)
        return result


    def execute_sorted(self, command, sortKey, sortReverse=False):
        if type(command) not in (str, unicode):
            command = ' '.join(command)
        key = command + '_%s_%s' % (sortKey, sortReverse)
        
        cached = self._dbcache.get(key)
        if cached is not None:
            return cached

        result = self.execute(command)
        xstart = datetime.utcnow()
        useLower = False
        if sortKey not in ('time', 'pos', 'songs'):
            useLower = True
        sorted_result = sorted(result, fieldSorter(sortKey, useLower), reverse=sortReverse)
        if command in self._cache_cmds:
            self._dbcache[key] = sorted_result
            
        diff = datetime.utcnow() - xstart
        ms = (diff.seconds * 1000) + (diff.microseconds / 1000)
        print "%d ms to sort data for: %s" % (ms, command)
        return sorted_result


    def findadd(self, what, name):
        end_in_list = False
        if self._in_list:
            end_in_list = True
            self.command_list_end()

        songs = self.find(what, name)
        self.command_list_ok_begin()
        for song in songs:
            self.add(song['file'])

        if end_in_list:
            return False
        else:
            self.command_list_end()
            return True


    def list(self, *args):
        command = 'list ' + ' '.join(args)
        cached = self._dbcache.get(command)
        if cached is not None:
            return cached
            
        what = args[0]
        data = self._safe_cmd(self.con.list, args)
        for index in range(len(data)):
            item = data[index]
            c = self._safe_cmd(self.con.count, (what, item))
            data[index] = {
                'title': item,
                'type': what,
                what: item,
                'time': c['playtime'],
                'ptime': hmsFromSeconds(c['playtime']),
                'songs': int(c['songs'])
            }
        
        try:
            self.lock.acquire()
            self._dbcache[command] = data
        except Exception, e:
            traceback.print_exc(file=sys.stdout)
        finally:
            self.lock.release()
        return data


    def listplaylists(self, *args):
        command = 'listplaylists'
        cached = self._dbcache.get(command)
        if cached is not None:
            return cached
            
        data = self._safe_cmd(self.con.listplaylists, args)
        for index in range(len(data)):
            item = data[index]['playlist']
            songs = self._safe_cmd(self.con.listplaylistinfo, (item,))
            playtime = sum([int(x.get('time', 0)) for x in songs])
            data[index] = {
                'title': item,
                'type': 'playlist',
                'playlist': item,
                'songs': len(songs),
                'time': playtime,
                'ptime': hmsFromSeconds(playtime)
            }
            
        try:
            self.lock.acquire()
            self._dbcache[command] = data
        except Exception, e:
            traceback.print_exc(file=sys.stdout)
        finally:
            self.lock.release()
        return data


    def load(self, playlistName, replace=False):
        wasPlaying = False
        if replace:
            if self.state['state'] == 'play':
                wasPlaying = True
            self._safe_cmd(self.con.clear, [])
        elif int(self.state['playlistlength']) == 0:
            replace = True
        ret = self._safe_cmd(self.con.load, [playlistName])
        if wasPlaying:
            self._safe_cmd(self.con.play, ['0'])
        if replace:
            self.lock.acquire()
            try:
                self.state['playlistname'] = playlistName
            except Exception, e:
                print '-'*60
                traceback.print_exc(file=sys.stdout)
                print '-'*60
            finally:
                self.lock.release()
        return ret


    def save(self, playlistName):
        OK = False
        try:
            ret = self._safe_cmd(self.con.save, [playlistName])
            OK = True
        except MPDError, e:
            if '{save} Playlist already exists' in str(e):
                self._safe_cmd(self.con.rm, [playlistName])
                ret = self._safe_cmd(self.con.save, [playlistName])
                OK = True
        if OK:
            self.lock.acquire()
            try:
                self.state['playlistname'] = playlistName
            except Exception, e:
                print '-'*60
                traceback.print_exc(file=sys.stdout)
                print '-'*60
            finally:
                self.lock.release()
        return ret
        
        
    def password(self, pw):
        self._password = pw
        self._safe_cmd(self.con.password, pw)
        self.lock.acquire()
        try:
            _Poller.password = pw
            _Poller.con.password(pw)
        except Exception, e:
            print '-'*60
            traceback.print_exc(file=sys.stdout)
            print '-'*60
        finally:
            self.lock.release()
            
            
    def raw(self, cmd):
        t = []
        self.lock.acquire()
        try:
            self.con._write_line(cmd)
            rl = self.con._read_line
            line = rl()
            while line is not None:
                t.append(line)
                line = rl()
            t.append("OK\n")
            return '\n'.join(t)
        except Exception, e:
            print '-'*60
            traceback.print_exc(file=sys.stdout)
            print '-'*60
            return e.message
        finally:
            self.lock.release()
        


    def sync(self, changes=None):                       
        if not changes:
            """
            Called by the server's status method, which means mpd.idle() 
            has not returned with any significant changes.  The only item
            which could change without causing a full sync is elapsed,
            so just update the elapsed seconds if playing.
            """
            if self.state.get('state', '') == 'play':
                n = datetime.utcnow()
                diff = n - self.lastcheck
                s = self.state.copy()
                s['elapsed'] = int(s['elapsed']) + diff.seconds
                return s
            else:
                return self.state
                
        self.lock.acquire()
        try:
            s = self.con.stats()
            s.update(self.con.status())
            t = s.get('time', '0:0').split(':')
            s['elapsed'] = t[0]
            if s.get('state', '') != 'stop':
                s.update(self.con.currentsong())

            if s.get('db_update') <> self.state.get('db_update'):
                self._dbcache = {}

            plver = self.playlist.version
            if plver <> s['playlist']:
                if self._dbcache.has_key('playlistinfo'):
                    del self._dbcache['playlistinfo']
                ln = int(s['playlistlength'])
                if ln == 0:
                    s['playlistname'] = 'Untitled'
                
                plstart = datetime.utcnow()
                self.playlist.update(self.con.plchanges(plver), ln)
                diff = datetime.utcnow() - plstart
                ms = (diff.seconds * 1000) + (diff.microseconds / 1000)
                print "%d ms to load playlist updates." % ms
                self.playlist.version = s['playlist']
            
            if 'stored_playlist' in changes:
                if self._dbcache.has_key('listplaylists'):
                    del self._dbcache['listplaylists']
                s['playlists'] = datetime.utcnow().ctime()
                
            self.state.update(s)
            self.lastcheck = datetime.utcnow()

        except (ConnectionError, socket.error), e:
            print "%s\n    reconnecting..." % e
            self._connect()

        except Exception, e:
            print '-'*60
            traceback.print_exc(file=sys.stdout)
            print '-'*60

        finally:
            self.lock.release()
            return self.state


def hmsFromSeconds(seconds):
    seconds = int(seconds)
    if not seconds:
        return ''
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    if h == 0:
        return "%d:%02d" % (m, s)
    else:
        return "%d:%02d:%02d" % (h, m, s)



def prettyDuration(sec):
    sec = int(sec)
    if not sec:
        return ''

    _str = ''
    d = int(sec/86400)
    sec -= d * 86400
    if d:
        _str = str(d) + ' days, '
        
    h = int(sec/3600)
    sec -= h * 3600
    if h:
        _str += str(h) + ' hours, '
        
    if d or h:
        m = int(round(sec/60))
        _str += str(m) + ' minutes'
    else:
        m = int(sec/60)
        sec -= m * 60
        _str += '%s minutes, %s seconds' % (m, sec)
        
    return _str


def fieldSorter(field, useLower):
    if useLower:
        def sorter(x, y):
            xt = x['type'] == 'directory'
            yt = y['type'] == 'directory'
            if xt and not yt:
                return -1
            if yt and not xt:
                return 1
            x = x.get(field, "").lower()
            y = y.get(field, "").lower()
            if x < y:
                return -1
            if x > y:
                return 1
            return 0
    else:
        def sorter(x, y):
            xt = x['type'] == 'directory'
            yt = y['type'] == 'directory'
            if xt and not yt:
                return -1
            if yt and not xt:
                return 1
            x = x.get(field, -1)
            y = y.get(field, -1)
            if x < y:
                return -1
            if x > y:
                return 1
            return 0
    return sorter
