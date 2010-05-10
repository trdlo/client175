#!/usr/bin/env python
#
#       extmpd.py
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


import cherrypy, json, os
from time import sleep
from datetime import datetime, timedelta
import mpd_proxy2 as mpd_proxy
from mpd import MPDError
import lyrics as _lyrics
from covers import CoverSearch

mpd = mpd_proxy.Mpd()
MUSIC_DIR = "/home/chris/Music"
LOCAL_DIR = os.path.join(os.getcwd(), os.path.dirname(__file__))
COVERS_DIR = os.path.join(LOCAL_DIR, "static", "covers")
cs = CoverSearch(COVERS_DIR)

cherrypy.config.update( {
    'tools.log_tracebacks.on': False,
    'server.thread_pool': 10,
    'server.socket_host': '0.0.0.0'
} )

import metadata
from metadata._base import NotReadable, NotWritable

class Root:

    static = cherrypy.tools.staticdir.handler(
                section="/static",
                dir=os.path.join(LOCAL_DIR, "static"),
            )


    def _error_page_501(status, message, traceback, version):
        return message
    cherrypy.config.update({'error_page.501': _error_page_501})

        
    def add(self, *args):
        if len(args) == 2:
            if args[0] in ('file', 'directory'):
                mpd.add(args[1])
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
            mpd.add(args[0])
    add.exposed = True


    def covers(self, artist, album=None):
        image = cs.find(artist, album)
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
            result = mpd.execute(args)
        except MPDError, e:
            raise cherrypy.HTTPError(501, message=str(e))
        return json.dumps(result)
    default.exposed = True


    def edit(self, id, itemtype, **kwargs):            
        if itemtype == 'playlist':
            newname = kwargs.get("playlist")
            if newname:
                mpd.rename(id, newname)
            else:
               raise cherrypy.HTTPError(501, message="New playlist name not found.")
               
        elif itemtype == 'file':
            ids = id.split(";")
            try:
                mpd.hold = True
                sleep_time = 0.5
                tags = {}
                for tag, val in kwargs.items():
                    tag = tag.lower()
                    if tag == 'track':
                        tags['tracknumber'] = val
                    elif tag == 'disc':
                        tags['discnumber'] = val
                    else:
                        tags[tag] = val
                        
                for id in ids:
                    if not id.lower().endswith(".wav"):
                        sleep_time += 0.1
                        loc = os.path.join(MUSIC_DIR, id)
                        f = metadata.get_format(loc)
                        f.write_tags(tags)
                        
                        updated = False
                        while not updated:
                            try:
                                mpd.update(id)
                                updated = True
                            except MPDError, e:
                                if str(e) == "[54@0] {update} already updating":
                                    sleep(0.01)
                                else:
                                    print e
                                    break
            finally:
                # Sleep to let all of the updates go through and avoid
                # forcing too many db_update refreshes.
                if sleep_time > 2:
                    sleep(2)
                else:
                    sleep(sleep_time)
                mpd.hold = False
                    
            return "OK"
        else:
            raise cherrypy.HTTPError(501, message="Editing of type '%s' not supported." % itemtype)
    edit.exposed = True


    def home(self):
        result = [
            {
                'title': 'Music Folder  (%s songs)' % mpd.state['songs'],
                'type': 'directory',
                'directory': '/'
            },
            {
                'title': 'Albums  (%s)' % mpd.state['albums'],
                'type': 'album',
                'album': ''
            },
            {
                'title': 'Artists  (%s)' % mpd.state['artists'],
                'type': 'artist',
                'artist': ''
            },
            {
                'title': 'Playlists',
                'type': 'playlist',
                'playlist': ''
            }
        ]
        return json.dumps(result)
    home.exposed = True


    def index(self):
        mpd.sync()
        stats = ["<tr><td><b>%s:</b></td><td>&nbsp;&nbsp;%s</td></tr>" % (k, v) for k,v in mpd.state.items()]
        return "<table>" + "".join(stats) + "</table>"
    index.exposed = True


    def lyrics(self, title, artist='', **kwargs):
        response = _lyrics.find(title, artist)
        d = response.toDict()
        return json.dumps(d)
    lyrics.exposed = True


    def password(self, passwd=None):
        if passwd is not None:
            mpd.password(passwd)
    password.exposed = True


    def playlistinfoext(self, **kwargs):
        data = mpd.playlistinfo()
        if data and kwargs.get('albumheaders'):
            result = []
            g = data[0].get
            a = {
                'album': g('album', 'Unknown'),
                'artist': g('albumartist', g('artist', 'Unknown')),
                'cls': 'album-group-start',
                'id': 'aa0'
            }       
            i = 0
            result.append(a)
            for d in data:
                g = d.get
                if a['album'] != g('album', 'Unknown'):
                    result[-1]['cls'] = 'album-group-end album-group-track'
                    i += 1
                    a = {
                        'album': g('album', 'Unknown'),
                        'artist': g('albumartist', g('artist', 'Unknown')),
                        'cls': 'album-group-start',
                        'id': 'aa%d' % i
                    }
                    result.append(a)
                elif a['artist'] != g('albumartist', g('artist', 'Unknown')):
                    a['artist'] = 'Various Artists'
                    
                d['cls'] = 'album-group-track'
                result.append(d)
                
            return json.dumps(result)
        else:
            return json.dumps(data)
    playlistinfoext.exposed = True
                

    def query(self, cmd, start=0, limit=0, sort='', dir='ASC', **kwargs):
        node = kwargs.get("node", False)
        if node:             
            return self.tree(cmd, node)
            
        start = int(start)
        if sort:
            data = mpd.execute_sorted(cmd, sort, dir=='DESC')
        else:
            data = mpd.execute(cmd)
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

        return json.dumps(result)
    query.exposed = True


    def status(self, **kwargs):
        mpd.sync()
        n = 0
        while n < 50:
            for k, v in mpd.state.items():
                if k <> 'uptime' and kwargs.get(k, '') <> str(v):
                    print '%s: %s <> %s' % (k, kwargs.get(k, ''), str(v))
                    return json.dumps(mpd.state)
            sleep(0.11)
            n += 1
            mpd.sync()
        return json.dumps(mpd.state)
    status.exposed = True


    def tree(self, cmd, node, **kwargs):
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
            data = [x for x in mpd.execute_sorted(cmd, itemType) if x.get('title')]
            
            if itemType in ['directory', 'playlist']:
                result = [x for x in data if x['type'] == itemType]
            elif len(data) > 200:
                result = []
                letters = sorted(set([x['title'][0].upper() for x in data]))
                special = {
                    'text': "'(.0-9?",
                    'iconCls': 'icon-'+itemType,
                    'cls': 'group-by-letter',
                    'children': [x for x in data if x['title'][0] < 'A']
                }
                result.append(special)
                for char in letters:
                    if char >= 'A' and char < 'Z':
                        container = {
                            'text': char,
                            'iconCls': 'icon-'+itemType,
                            'cls': 'group-by-letter',
                            'children': [x for x in data if x['title'][0].upper() == char]
                        }
                        result.append(container)
                container = {
                    'text': 'Z+',
                    'iconCls': 'icon-'+itemType,
                    'cls': 'group-by-letter',
                    'children': [x for x in data if x['title'][0].upper() > 'Y']
                }
                result.append(container)
            else:
                result = data
        return json.dumps(result)
    tree.exposed = True



cherrypy.quickstart(Root())
# Uncomment the following to use your own favicon instead of CP's default.
#favicon_path = os.path.join(LOCAL_DIR, "favicon.ico")
#root.favicon_ico = tools.staticfile.handler(filename=favicon_path)
