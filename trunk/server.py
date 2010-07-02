#!/usr/bin/env python
#
#       Client175
#
#       Copyright 2009 Chris Seickel
#
#       This program is free software; you can redistribute it and/or modify
#       it under the terms of the GNU General Public License as published by
#       the Free Software Foundation; either version 3 of the License, or
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


import cherrypy, json, os, urllib, urllib2
from BeautifulSoup import BeautifulSoup
from time import sleep
from datetime import datetime, timedelta
import mpd_proxy2 as mpd_proxy
from mpd import MPDError
from covers import CoverSearch
import metadata
from metadata._base import NotReadable, NotWritable


cherrypy.config.update( {
    'server.thread_pool': 10,
    'server.socket_host': '0.0.0.0'
} )
LOCAL_DIR = os.path.join(os.getcwd(), os.path.dirname(__file__))
cherrypy.config.update(os.path.join(LOCAL_DIR, "site.conf"))

MUSIC_DIR = cherrypy.config.get('music_directory', '/var/lib/mpd/music/')
MUSIC_DIR = os.path.expanduser(MUSIC_DIR)
COVERS_DIR = os.path.join(LOCAL_DIR, "static", "covers")
LOCAL_COVERS = cherrypy.config.get('local_covers', None)
if LOCAL_COVERS:
    for i in range(len(LOCAL_COVERS)):
        LOCAL_COVERS[i] = os.path.expanduser(LOCAL_COVERS[i])

HOST = "localhost"
PORT = 6600
PASSWORD = None

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
    
HOST = cherrypy.config.get('mpd_host', HOST)
PORT = cherrypy.config.get('mpd_port', PORT)
PASSWORD = cherrypy.config.get('mpd_password', PASSWORD)


mpd = mpd_proxy.Mpd(HOST, PORT, PASSWORD)
cs = CoverSearch(COVERS_DIR, LOCAL_COVERS)


class Root:

    static = cherrypy.tools.staticdir.handler(
                section="/static",
                dir=os.path.join(LOCAL_DIR, "static"),
            )


    def _error_page_501(status, message, traceback, version):
        return message
    cherrypy.config.update({'error_page.501': _error_page_501})

        
    def about(self, *args):
        """
        Convert AUTHORS.txt into a web page with links.
        """
        f = open(os.path.join(LOCAL_DIR, "AUTHORS.txt"), "r")
        txt = []
        for line in f.readlines():
            if line.startswith("Website:  http://"):
                href = line.replace("Website:  ", "")
                line = "Website:  <a target='_blank' href='%s'>%s</a>" % (href, href)
            if line.startswith("License:  "):
                href = line.replace("License:  ", "")
                if not href.startswith("static/"):
                    href = "static/" + href
                line = "License:  <a target='_blank' href='%s'>%s</a>" % (href, href)
            txt.append(line)
            
        f.close()
        return '<html><body>' + '<br>'.join(txt) + '</body></html>'
    about.exposed = True
    
        
    def add(self, *args):
        if len(args) == 2:
            if args[0] in ('file', 'directory'):
                d = args[1]
                if d.startswith("/"):
                    d = d[1:]
                mpd.add(d)
            elif args[0] == 'playlist':
                mpd.load(args[1])
            elif args[0] == 'search':
                files = mpd.execute(('search', 'any', args[1]))
                if files:
                    mpd.command_list_ok_begin()
                    for f in files:
                        mpd.add(f['file'])
                    mpd.command_list_end()
            else:
                mpd.findadd(args[0], args[1])
        else:
            d = args[0]
            if d.startswith("/"):
                d = d[1:]
            mpd.add(d)
    add.exposed = True


    def covers(self, **kwargs):
        f = kwargs.get('file')
        path = None
        artist = kwargs.get('artist')
        album = kwargs.get('album')
        if f:
            path = os.path.join(MUSIC_DIR, f)
            path = os.path.dirname(path)
            if not artist:
                _file = mpd.lsinfo(f)
                artist = _file.get('artist')
                album = _file.get('album')
        image = cs.find(path, artist, album)
        u = cherrypy.url().split('covers')[0]
        if image:
            url = u+'static/covers/'+image
        else:
            url = u+'static/covers/album_blank.png'
        raise cherrypy.HTTPRedirect(url, 301)
    covers.exposed = True


    def default(self, *args):
        """
        Wrap mpd commands in a REST API and return json encoded output.
        Any URL not already defined is assumed to be an mpd command.
        Usage:
            The mpd protocol command:
                list album artist "David Bowie"

            ...is equivilant to a GET request to:
                http://localhost:8080/list/album/artist/David%20Bowie
        """
        try:
            if len(args) == 1:
                args = args[0]
            result = mpd.execute(args)
        except MPDError, e:
            raise cherrypy.HTTPError(501, message=str(e))
        return json.dumps(result)
    default.exposed = True


    def edit(self, id, **kwargs):
        err = """THE FILE OR DIRECTORY DOES NOT EXIST!\n
        \n
        %s\n
        \n
        Please set the music_directory option in site.conf."""
        
        if not os.path.exists(MUSIC_DIR):
            raise cherrypy.HTTPError(501, message=err % MUSIC_DIR)
                
        loc = os.path.join(MUSIC_DIR, id)
        if not os.path.exists(loc):
            raise cherrypy.HTTPError(501, message=err % loc)
            
        if loc.lower().endswith(".wav"):
            return "WAV editing not supported."
            
        tags = {}
        for tag, val in kwargs.items():
            tag = tag.lower()
            if tag == 'track':
                tags['tracknumber'] = val
            elif tag == 'disc':
                tags['discnumber'] = val
            else:
                tags[tag] = val
            print '%s[%s] = "%s"' % (id, tag, val)
            
        f = metadata.get_format(loc)
        f.write_tags(tags)
                            
        updating = False
        while not updating:
            try:
                mpd.update(id)
                updating = True
            except MPDError, e:
                if str(e) == "[54@0] {update} already updating":
                    sleep(0.01)
                else:
                    raise cherrypy.HTTPError(501, message=e)
        
        return "OK"
    edit.exposed = True


    def home(self, **kwargs):
        dl = len(mpd.execute('list date'))
        gl = len(mpd.execute('list genre'))
        pl = len(mpd.listplaylists())
        tm = mpd_proxy.prettyDuration(mpd.state['db_playtime'])
        result = {}
        result['data'] = [
            {
                'title': 'Songs',
                'type': 'directory',
                'directory': '/',
                'ptime': mpd.state['songs'],
                'id': 'directory:'
            },
            {
                'title': 'Total Playtime',
                'type': 'time',
                'directory': '/',
                'ptime': tm,
                'id': 'time:'
            },
            {
                'title': 'Albums',
                'type': 'album',
                'ptime': mpd.state['albums'],
                'id': 'album:'
            },
            {
                'title': 'Artists',
                'type': 'artist',
                'ptime': mpd.state['artists'],
                'id': 'artist:'
            },
            {
                'title': 'Dates',
                'type': 'date',
                'ptime': dl,
                'id': 'date:'
            },
            {
                'title': 'Genres',
                'type': 'genre',
                'ptime': gl,
                'id': 'genre:'
            },
            {
                'title': 'Playlists',
                'type': 'playlist',
                'ptime': pl,
                'id': 'playlist:'
            }
        ]
        result['totalCount'] = len(result['data'])
        return json.dumps(result)
    home.exposed = True


    def index(self):
        raise cherrypy.HTTPRedirect('static/index.html', 301)
    index.exposed = True
    
    
    def filter_results(self, data, filter):
        filter = filter.lower()
        d = []
        skip = ('type', 'time', 'ptime', 'songs')
        for item in data:
            for key, val in item.items():
                if key not in skip:
                    if filter in str(val).lower():
                        d.append(item)
                        break
        return d


    def lyrics(self, title, artist, **kwargs):
        # proxy to http://www.lyricsplugin.com to get around
        # same-origin policy of browsers
        artist = urllib.quote(artist.strip())
        title = urllib.quote(title.strip())
        url = "http://www.lyricsplugin.com/winamp03/plugin/?artist=%s&title=%s"
        sock = urllib.urlopen( url % (artist,title) )
        text = sock.read()
        sock.close()
        soup = BeautifulSoup(text)
        div = soup.find("div", id="lyrics")
        if div:
            return "".join([str(x) for x in div.contents]).strip() 
        return "Not Found"
    lyrics.exposed = True


    def moveend(self, ids, **kwargs):
        if ids:
            ids = ids.split(".")
            mpd.command_list_ok_begin()
            end = len(mpd.playlist) - 1
            for id in ids:
                if id.isdigit():
                    mpd.moveid(id, end)
            mpd.command_list_end()
            return "OK"
    moveend.exposed = True


    def movestart(self, ids, **kwargs):
        if ids:
            ids = reversed(ids.split("."))
            mpd.command_list_ok_begin()
            for id in ids:
                if id.isdigit():
                    mpd.moveid(id, 0)
            mpd.command_list_end()
            return "OK"
    movestart.exposed = True


    def password(self, passwd=None):
        if passwd is not None:
            mpd.password(passwd)
    password.exposed = True


    def playlistinfoext(self, **kwargs):
        data = mpd.playlistinfo()
        filter = kwargs.get('filter')
        start = int(kwargs.get('start', 0))
        limit = kwargs.get('limit', None)
        
        if filter:
            data = self.filter_results(data, filter)
           
        ln = len(data)
        if limit:
            end = start + int(limit)
            if end > ln:
                end = ln
            data = data[start:end]
            
        if data and kwargs.get('albumheaders'):
            result = []
            
            def makeHeader(dg):
                return {
                    'album': dg('album', 'Unknown'),
                    'artist': dg('albumartist', dg('artist', 'Unknown')),
                    'file': dg('file'),
                    'cls': 'album-group-start'
                }
                
            a = makeHeader(data[0].get)
            result.append(a)
            for d in data:
                g = d.get
                if a['album'] != g('album', 'Unknown'):
                    result[-1]['cls'] = 'album-group-end album-group-track'
                    a = makeHeader(g)
                    result.append(a)
                elif a['artist'] != g('albumartist', g('artist', 'Unknown')):
                    a['artist'] = 'Various Artists'
                    
                d['cls'] = 'album-group-track'
                result.append(d)
        else:
            result = data
            
        if limit:
            resultp = {}
            resultp['totalCount'] = ln
            resultp['data'] = result
            return json.dumps(resultp)
        else:
            return json.dumps(result)
    playlistinfoext.exposed = True


    def protocol(self, cmd):
        """
        Run mpd protocol command as string and return raw text results.
        """
        try:
            return mpd.raw(cmd)
        except MPDError, e:
            raise cherrypy.HTTPError(501, message=str(e))
    protocol.exposed = True
                

    def query(self, cmd, start=0, limit=0, sort='', dir='ASC', **kwargs):
        if not cmd:
            return self.home()
            
        node = kwargs.get("node", False)
        if node:
            m = int(kwargs.get('mincount', 0))
            return self.tree(cmd, node, m)
            
        start = int(start)
        if sort:
            data = mpd.execute_sorted(cmd, sort, dir=='DESC')
        else:
            data = mpd.execute(cmd)
            
        filter = kwargs.get('filter')
        if filter:
            data = self.filter_results(data, filter)
            
        if limit:
            ln = len(data)
            end = start + int(limit)
            if end > ln:
                end = ln
            result = {}
            result['totalCount'] = ln
            result['data'] = data[start:end]
        else:
            result = data
            
        if cmd.startswith('list '):
            return json.dumps(result)
            
        if cmd in ('playlistinfo', 'listplaylists'):
            return json.dumps(result)
            
        if limit:
            data = result['data']
            
        for i in range(len(data)):
            d = data[i]
            if d['type'] == 'file':
                pl = mpd.playlist.getByFile(d['file'])
                if pl:
                    data[i] = pl

        return json.dumps(result)
    query.exposed = True


    def status(self, **kwargs):
        client_uptime = kwargs.get('uptime')
        if not client_uptime:
            s = mpd.sync()
            return json.dumps(s)
        n = 0
        while n < 100:
            if mpd.state.get('uptime', '') <> client_uptime:
                return json.dumps(mpd.state)
            sleep(0.1)
            n += 1
        return 'NO CHANGE'
    status.exposed = True


    def tree(self, cmd, node, mincount=0, **kwargs):
        if node == 'directory:':
            result = []
            rawdata = mpd.listall()
            data = []
            for d in rawdata:
                directory = d.get("directory")
                if directory:
                    parts = directory.split("/")
                    data.append({
                        'title': parts.pop(),
                        'parent': '/'.join(parts),
                        'directory': directory,
                        'type': 'directory',
                        'leaf': True
                    })
                    
            def loadChildren(parent, parentpath):
                children = [x for x in data if x['parent'] == parentpath]
                if children:
                    parent['leaf'] = False
                    parent['children'] = []
                    for c in children:
                        parent['children'].append(c)
                        loadChildren(c, c['directory'])
                        
            root = {}
            loadChildren(root, '')
            result = root['children']
        else:
            itemType = node.split(":")[0]
            data = [x for x in mpd.execute_sorted(cmd, 'title') if x.get('title')]
            if mincount:
                mincount -= 1
                data = [x for x in data if x['songs'] > mincount]
            
            if itemType == 'directory':
                result = [x for x in data if x['type'] == itemType]
            elif len(data) > 200:
                result = []
                iconCls = 'icon-group-unknown icon-group-'+itemType
                cls = 'group-by-letter'
                letters = sorted(set([x['title'][0].upper() for x in data]))
                special = {
                    'text': "'(.0-9?",
                    'iconCls': iconCls,
                    'cls': cls,
                    'children': [x for x in data if x['title'][0] < 'A']
                }
                result.append(special)
                for char in letters:
                    if char >= 'A' and char < 'Z':
                        container = {
                            'text': char,
                            'iconCls': iconCls,
                            'cls': cls,
                            'children': [x for x in data if x['title'][0].upper() == char]
                        }
                        result.append(container)
                container = {
                    'text': 'Z+',
                    'iconCls': iconCls,
                    'cls': cls,
                    'children': [x for x in data if x['title'][0].upper() > 'Y']
                }
                result.append(container)
            else:
                result = data
        return json.dumps(result)
    tree.exposed = True



# Uncomment the following to use your own favicon instead of CP's default.
#favicon_path = os.path.join(LOCAL_DIR, "favicon.ico")
#root.favicon_ico = tools.staticfile.handler(filename=favicon_path)

shost = cherrypy.config.get('server.socket_host')
sport = cherrypy.config.get('server.socket_port')
if shost == '0.0.0.0':
    shost = 'localhost'
print "Server Ready."
print "Client175 is available at:  http://%s:%s" % (shost, sport)
cherrypy.quickstart(Root())
