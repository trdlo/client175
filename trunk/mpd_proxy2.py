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
from functools import partial


_Instance = None
_Poller = None



def Mpd(host, port, password):
    """
    Returns a singleton MPD instance and starts a poller which utilizes
    the mpd idle command.  The state attribute is automatically updated
    with the output of stats, status, and currentsong.
    
    The elapsed time is not updated between seek/player events, call 
    Mpd.sync() to force an update if needed.
    """
    global _Instance
    if _Instance is None:
        _Instance = _Mpd_Instance(host, port, password)
        _Poller = _Mpd_Poller(host, port, password)
        _Poller.setDaemon(True)
        _Poller.start()
    return _Instance



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

        self.con.connect(self._host, self._port, self._password)
            
    
    def run(self):
        global _Instance
        self._connect()
        _Instance.sync(['startup'])
        while True:
            try:
                changes = self.con.idle()
                _Instance.sync(changes)
            except Exception, e:
                print "ERROR IN MPD_POLLER: %s" % e
                sleep(1.0)
                self._connect()
                _Instance.sync(['startup'])
        print "Exiting MPD Poller..."
                


def cache_cmd_cls(fn):
    def wrapper(self, *args):
        command = (fn.__name__,) + args
        print command
        cached = self._dbcache.get(command)
        if cached is not None:
            return cached
        data = fn(self, *args)   
        self.lock.acquire()
        try:
            self._dbcache[command] = data
        finally:
            self.lock.release()
        return data
    return wrapper
        
        
def cache_cmd_base(fn):
    global _Instance
    self = _Instance
    def wrapper(*args):
        command = (fn.__name__,) + args
        print command
        cached = self._dbcache.get(command)
        if cached is not None:
            return cached
        data = fn(*args)   
        self.lock.acquire()
        try:
            self._dbcache[command] = data
        finally:
            self.lock.release()
        return data
    return wrapper
    

class _Mpd_Instance:
    """
    Creates a singleton mpd instance where connection issues are handled
    automatically.

    This proxy class adds a state object and a sync method.
    Rather than calling to status, stats, and currentsong separately,
    call sync() periodically and read the results from the mpd.state dict
    which merges the output of all of these commands.
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
        self._playlistFiles = {}
        self._playlistlength = 0
        self._dbcache = {}
        self._cache_cmds = ('list', 'listall', 'listallinfo', 'lsinfo', 'find', 'search')
        self._extendDb_cmds = ('listallinfo', 'lsinfo', 'find', 'search', 'playlistinfo', 
                                'playlistfind', 'playlistsearch', 'listplaylistinfo')
        self.lock = threading.RLock()
        self.lock.acquire()
        try:
            self._connect()
        finally:
            self.lock.release()


    def _connect(self):
        try:
            if self.con:
                self.con.disconnect()
            else:
                self.con = MPDClient()
        except:
            self.con = MPDClient()
        self.con.connect(self._host, self._port, self._password)


    def __getattr__(self, name):
        fn = getattr(self.con, name)
        if name in self._cache_cmds:
            fn.__name__ = name
            wrapped = cache_cmd_base(fn)
        else:
            wrapped = fn
            
        if name in self._extendDb_cmds:
            return lambda *args: self._extendDbResult(wrapped(*args))
        return wrapped


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
                item['title'] = item['directory'].rsplit('/', 1)[-1]
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
        
        
    def command_list_ok_begin(self):
        self.lock.acquire()
        try:
            self.con.command_list_ok_begin()
        except Exception, e:
            self.lock.release()
            raise


    def command_list_end(self):
        try:
            return self.con.command_list_end()
        finally:
            self.lock.release()


    def crop(self, pos=None):
        if pos is None:
            pos = int(self.state['song'])
        self.command_list_ok_begin()
        for i in xrange(self._playlistlength-1, -1, -1):
            if i != pos: 
                self.con.delete(i)
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
            term = re.search('\s\"(.+)\"', command)
            if term:
                cmdlist = command[:term.start(0)].split(" ")
                cmdlist.append(term.group(1))
            else:
                cmdlist = command.split(" ")
        else:
            cmdlist = list(command)
            
        cmd = cmdlist.pop(0)
        return getattr(self, cmd)(*cmdlist)


    def execute_sorted(self, command, sortKey, sortReverse=False):
        key = (command, sortKey, sortReverse)
        cached = self._dbcache.get(key)
        if cached is not None:
            return cached
        result = self.execute(command)
        useLower = False
        if sortKey not in ('time', 'pos', 'songs'):
            useLower = True
        sorted_result = sorted(result, fieldSorter(sortKey, useLower), reverse=sortReverse)
        if command in self._cache_cmds:
            self.lock.acquire()
            try:
                self._dbcache[key] = sorted_result
            finally:
                self.lock.release()
        return sorted_result


    def findadd(self, type, what):
        songs = self.find(type, what)
        self.command_list_ok_begin()
        for song in songs:
            self.con.add(song['file'])
        self.command_list_end()
            
            
    def getPlaylistByFile(self, fpath):
        if self._playlistlength == 0:
            return False
        item = self._playlistFiles.get(fpath, None)
        if item is None:
            pl = self.con.playlistfind('file', fpath)
            if pl:
                item = self._extendDbResult(pl)[0]
            else:
                item = False
            self.lock.acquire()
            try:
                self._playlistFiles[fpath] = item
            finally:
                self.lock.release()
        return item
        
        
    @cache_cmd_cls
    def list(self, *args):
        what = args[0]
        data = self.con.list(*args)
        for index in range(len(data)):
            item = data[index]
            c = self.con.count(what, item)
            data[index] = {
                'title': item,
                'type': what,
                what: item,
                'time': c['playtime'],
                'ptime': hmsFromSeconds(c['playtime']),
                'songs': int(c['songs'])
            }
        return data


    @cache_cmd_cls
    def listplaylists(self, *args):
        data = self.con.listplaylists(*args)
        for index in range(len(data)):
            item = data[index]['playlist']
            songs = self.con.listplaylistinfo(item)
            playtime = sum([int(x.get('time', 0)) for x in songs])
            data[index] = {
                'title': item,
                'type': 'playlist',
                'playlist': item,
                'songs': len(songs),
                'time': playtime,
                'ptime': hmsFromSeconds(playtime)
            }
        return data


    def load(self, playlistName, replace=False):
        wasPlaying = False
        self.lock.acquire()
        try:
            if replace:
                if self.state['state'] == 'play':
                    wasPlaying = True
                self.con.clear()
                self.state['playlistname'] = playlistName
            elif int(self.state['playlistlength']) == 0:
                self.state['playlistname'] = playlistName
            self.con.load(playlistName)
            if wasPlaying:
                self.con.play(0)
        finally:
            self.lock.release()
        
        
    def password(self, pw):
        self.lock.acquire()
        try:
            self._password = pw
            _Poller.password = pw
            self.con.password(pw)
            _Poller.con.password(pw)
        finally:
            self.lock.release()
            
            
    def raw(self, cmd):
        t = []
        self.con.ping()
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
        finally:
            self.lock.release()


    def save(self, playlistName):
        OK = False
        try:
            self.con.save(playlistName)
            OK = True
        except MPDError, e:
            if '{save} Playlist already exists' in str(e):
                self.con.rm(playlistName)
                self.con.save(playlistName)
                OK = True
        if OK:
            self.lock.acquire()
            try:
                self.state['playlistname'] = playlistName
            finally:
                self.lock.release()


    def searchadd(self, type, what):
        songs = self.con.search(type, what)
        self.command_list_ok_begin()
        for song in songs:
            self.con.add(song['file'])
        self.command_list_end()
            
            
    def setPlaylistFiles(self, songList):
        files = dict( ((x['file'], x) for x in songList) )
        try:
            self.lock.acquire()
            self._playlistFiles.update(files)
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
            if 'startup' in changes:
                changes = ['database', 'playlist', 'stored_playlist']
                
            s = self.con.stats()
            s.update(self.con.status())
            t = s.get('time', '0:0').split(':')
            s['elapsed'] = t[0]
            if s.get('state', '') != 'stop':
                item = self.con.currentsong()
                if not item.get('title'):
                    item['title'] = item['file'].rsplit('/', 1)[-1]
                s.update(item)

            if 'database' in changes:
                self._dbcache = {}

            if 'playlist' in changes:
                self._playlistFiles = {}
                self._playlistlength = int(s['playlistlength'])
                if self._playlistlength == 0:
                    s['playlistname'] = 'Untitled'
            
            if 'stored_playlist' in changes:
                if self._dbcache.has_key('listplaylists'):
                    del self._dbcache['listplaylists']
                s['playlists'] = datetime.utcnow().ctime()
                
            self.state.update(s)
            self.lastcheck = datetime.utcnow()
            return self.state

        finally:
            self.lock.release()



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
