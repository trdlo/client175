import cherrypy, json, os
from time import sleep
import mpd_proxy2 as mpd_proxy
import lyrics as _lyrics
from covers import CoverSearch

mpd = mpd_proxy.Mpd(host="192.168.1.2")
local_dir = os.path.join(os.getcwd(), os.path.dirname(__file__))
covers_dir = os.path.join(local_dir, "static", "covers")
cs = CoverSearch(covers_dir)
cache = {}

cherrypy.config.update( {
    'tools.log_tracebacks.on': True,
    'server.thread_pool': 10,
    'server.socket_host': '0.0.0.0'
} )


class Root:

    static = cherrypy.tools.staticdir.handler(
                section="/static",
                dir=os.path.join(local_dir, "static"),
            )


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
        result = mpd.execute(args)
        return json.dumps(result)
    default.exposed = True


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


    def lyrics(self, title, artist=''):
        response = _lyrics.find(title, artist)
        return json.dumps(response)
    lyrics.exposed = True


    def password(self, passwd=None):
        if passwd is not None:
            mpd.password(passwd)
    password.exposed = True


    def playlistinfoext(self, **kwargs):
        data = mpd.playlistinfo()
        if data and kwargs.get('albumheaders'):
            result = []
            a = {
                'album': data[0].get('album', 'Unknown'),
                'artist': data[0].get('artist', 'Unknown'),
                'cls': 'album-group-start',
                'id': 'aa0'
            }       
            i = 0
            result.append(a)
            for d in data:
                if a['album'] != d.get('album', 'Unknown'):
                    result[-1]['cls'] = 'album-group-end album-group-track'
                    i += 1
                    a = {
                        'album': d.get('album', 'Unknown'),
                        'artist': d.get('artist', 'Unknown'),
                        'cls': 'album-group-start',
                        'id': 'aa%d' % i
                    }
                    result.append(a)
                elif a['artist'] != d.get('artist', 'Unknown'):
                    a['artist'] = 'Various Artists'
                    
                d['cls'] = 'album-group-track'
                result.append(d)
                
            return json.dumps(result)
        else:
            return json.dumps(data)
    playlistinfoext.exposed = True
                

    def query(self, cmd, start=0, limit=0, sort='', dir='ASC', **kwargs):
        start = int(start)
        if sort:
            data = mpd.execute_sorted(cmd, sort, dir=='DESC')
        else:
            data = mpd.execute(cmd)
        
        node = kwargs.get("node", False)
        if node:
            if not cmd.startswith('list '):
                t = node.split(":")[0]
                result = [x for x in data if x['type'] == t]
            elif len(data) > 200:
                result = []
                data = [x for x in data if x['title']]
                letters = set([x['title'][0].upper() for x in data if x['title']])
                special = {
                    'text': "0-9",
                    'iconCls': 'icon-artist',
                    'children': []
                }
                result.append(special)
                for char in letters:
                    if char < 'A':
                        special['children'].extend([x for x in data if x['title'][0] == char])
                    elif char < 'ZZ':
                        container = {
                            'text': char,
                            'iconCls': 'icon-artist',
                            'children': [x for x in data if x['title'][0].upper() == char]
                        }
                        result.append(container)
            else:
                result = data
            return json.dumps(result)                
            
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
        while n < 100:
            for k, v in mpd.state.items():
                if k <> 'uptime' and kwargs.get(k, '') <> str(v):
                    print '%s: %s <> %s' % (k, kwargs.get(k, ''), str(v))
                    return json.dumps(mpd.state)
            sleep(0.11)
            n += 1
            mpd.sync()
        return json.dumps(mpd.state)
    status.exposed = True



cherrypy.quickstart(Root())
# Uncomment the following to use your own favicon instead of CP's default.
#favicon_path = os.path.join(local_dir, "favicon.ico")
#root.favicon_ico = tools.staticfile.handler(filename=favicon_path)
