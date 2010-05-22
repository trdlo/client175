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
import threading, re, os, socket
from copy import deepcopy
import sys, traceback


HOST = "localhost"
PORT = 6600
PASSWORD = None
_Instance = None


if os.environ.has_key("MPD_HOST"):
    mpd_host = str(os.environ["MPD_HOST"])
    if "@" in mpd_host:
        mpd_host = mpd_host.split("@")
        PASSWORD = mpd_host[0]
        HOST = mpd_host[1]
    else:
        HOST = mpd_host

if os.environ.has_key("MPD_PORT"):
    PORT = int(os.environ["MPD_PORT"])


def Mpd(**kwargs):
    global _Instance
    if _Instance is None:
        _Instance = _Mpd_Instance(**kwargs)
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
        old_length = len(self)
        if new_length >= old_length:
            for x in range(new_length - old_length):
                self.append(None)
        else:
            del self[new_length:]
        for change in changes:
            self[int(change['pos'])-1] = change
        self.files = None


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

    def __init__(self, host=None, port=None, password=None):
        if host is None:
            host = HOST
        if port is None:
            port = PORT
        if password is None:
            password = PASSWORD

        self._host = host
        self._port = port
        self._password = password
        self._in_list = False
        self.con = None
        self.state = {'db_update': 0, 'playlist': 0, 'playlistname': 'Untitled'}
        self.state_stamp = datetime.utcnow()
        self.state['playlists'] = self.state_stamp.ctime()
        self.playlist = _MpdPlaylist()
        self._dbcache = {}
        self._cache_cmds = ('list', 'lsinfo', 'find', 'search', 'playlistinfo')
        self.lock = threading.RLock()
        self._connect()
        self.hold = False
        self.sync(True)


    def __getattr__(self, name):
        if name == 'list':
            return self.list
        elif name == 'listplaylists':
            return self.listplaylists
        elif name == 'load':
            return self.load
        elif name == 'save':
            return self.save
        else:
            fn = self.con.__getattr__(name)

        if name in ('lsinfo', 'find', 'search', 'playlistinfo', 'listplaylistinfo'):
            return lambda *args: self._extendDbResult(self._safe_cmd(fn, args))
        elif name in ('save', 'rm', 'rename'):
            try:
                self.lock.acquire()
                self.state['playlists'] = datetime.utcnow().ctime()
            except Exception, e:
                print e
            finally:
                self.lock.release()
        return lambda *args: self._safe_cmd(fn, args)


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


    def _extendDbResult(self, data):
        for item in data:
            keys = item.keys()
            if 'file' in keys:
                item = self._extendFile(item)
                if 'pos' not in keys:
                    pl = self.playlist.getByFile(item['file'])
                    if pl:
                        item['pos'] = pl['pos']
                        item['id'] = pl['id']
            elif 'directory' in keys:
                item['type'] = 'directory'
                item['title'] = item['directory'].split('/')[-1]
                item['any'] = item['title']
                item['id'] = "directory:" + item['directory']
            elif 'playlist' in keys:
                item['type'] = 'playlist'
                item['title'] = item['playlist']
                item['any'] = item['title']
                item['id'] = "playlist:" + item['playlist']
            else:
                item['type'] = keys[0]
                item['title'] = item[keys[0]]
                item['any'] = item['title']
                item['id'] = keys[0] + ":" + item[keys[0]]
                
        return data


    def _extendFile(self, item):
        item['any'] = ' '.join(item.values())
        p = item.get('pos')
        if p:
            item['pos'] = int(p) + 1
        else:
            pl = self.playlist.getByFile(item['file'])
            if pl:
                item['pos'] = pl['pos']
                item['id'] = pl['id']
            else:
                item['id'] = "file:" + item['file']
        item['type'] = 'file'
        item['ptime'] = hmsFromSeconds(item.get('time', 0))
        if not item.get('title'):
            item['title'] = item['file'].split('/')[-1]
        return item


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
        return result


    def execute_sorted(self, command, sortKey, sortReverse=False):
        if type(command) not in (str, unicode):
            command = ' '.join(command)
        key = command + '_%s_%s' % (sortKey, sortReverse)
        
        cached = self._dbcache.get(key)
        if cached is not None:
            return cached

        result = self.execute(command)
        sorted_result = sorted(result, fieldSorter(sortKey), reverse=sortReverse)
        if command in self._cache_cmds:
            self._dbcache[key] = sorted_result
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
        what = args[0]
        data = self._safe_cmd(self.con.list, args)
        for index in range(len(data)):
            item = data[index]
            c = self._safe_cmd(self.con.count, (what, item))
            data[index] = {
                'title': item,
                'type': what,
                what: item,
                'playtime': int(c['playtime']),
                'songs': int(c['songs']),
                'any': item
            }
        return data


    def listplaylists(self, *args):
        data = self._safe_cmd(self.con.listplaylists, args)
        for index in range(len(data)):
            item = data[index]['playlist']
            data[index] = {
                'title': item,
                'type': 'playlist',
                'playlist': item,
                'any': item
            }
        return data


    def load(self, playlistName, replace=False):
        if replace:
            self._safe_cmd(self.con.clear, [])
        elif int(self.state['playlistlength']) == 0:
            replace = True
        ret = self._safe_cmd(self.con.load, [playlistName])
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
                self.state['playlists'] = datetime.utcnow().ctime()
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


    def sync(self, force=False):
        if self.hold:
            return self.state
            
        n = datetime.utcnow()
        if not force:
            # One update per 100 milliseconds is more than enough.
            dif = n - self.state_stamp
            if dif.microseconds < 100000:
                return self.state

        self.lock.acquire()
        try:
            s = self.con.stats()
            s.update(self.con.status())
            t = s.get('time', '0:0').split(':')
            s['elapsed'] = int(t[0])
            if s.get('state', '') != 'stop':
                s.update(self.con.currentsong())

            if s.get('db_update') <> self.state.get('db_update'):
                self._dbcache = {}

            plver = self.playlist.version
            if plver <> s['playlist']:
                self._dbcache = {}
                ln = int(s['playlistlength'])
                if ln == 0:
                    s['playlistname'] = 'Untitled'
                changes = [self._extendFile(x) for x in self.plchanges(plver)]
                self.playlist.update(changes, ln)
                self.playlist.version = s['playlist']

            self.state.update(s)
            self.state_stamp = n

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


def hmsFromSeconds(sec):
    sec = int(sec)
    if not sec:
        return ''

    _str = ''
    h = int(sec/3600)
    sec -= h * 3600
    if h:
        _str = str(h) + ':'

    m = int(sec/60)
    sec -= m * 60
    if _str and m < 10:
        _str += '0'
    _str += str(m) + ':'

    if _str and sec < 10:
        _str += '0'
    _str += str(sec)
    return _str


def fieldSorter(field):
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
    return sorter
