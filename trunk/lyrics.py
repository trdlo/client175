import sys, traceback, re, urllib, urllib2
from BeautifulSoup import BeautifulSoup

try:
    import xml.etree.cElementTree as cETree
except:
    import cElementTree as cETree

lyrics_cache = {}


class LyricsResponse(object):
    def __init__(self, responder=''):
        self.success = False
        self.lyrics = 'Not Found'
        self.responder = responder
        self.url = ''
    
    def toDict(self):
        d = {
            'success': self.success,
            'responder': self.responder,
            'url': self.url,
            'lyrics': self.lyrics
        }
        return d



def find(title, artist=''):
    key = "%s - %s" % (artist, title)
    cache = lyrics_cache.get(key, False)
    if cache:
        return cache
        
    lookups = [
        find_LyricsFly,
        find_ChartLyrics,
        #find_LyricsAstraWeb,
        find_LyricsPlugin
    ]
    for fn in lookups:
        result = fn(title, artist)
        if result.success:
            lyrics_cache[key] = result
            break
    return result


def fetch(url):
    sock = urllib.urlopen(url)
    txt = sock.read()
    sock.close()
    return txt
 
    
def find_ChartLyrics(title, artist):
    resp = LyricsResponse('ChartLyrics')
    if not artist:
        return resp
        
    try:
        artist_find = urllib.quote_plus(artist.lower().strip())
        title_find = urllib.quote_plus(title.lower().strip())
        url = "http://api.chartlyrics.com/apiv1.asmx/SearchLyricDirect?artist=%s&song=%s" % (artist_find,title_find)
        xml = fetch(url)
        tree = cETree.XML(xml)
        artist_result = tree.findtext('{http://api.chartlyrics.com/}LyricArtist')
        if artist_result is not None:
            artist_result = re.sub("[^A-Za-z0-9\s]", "", artist_result)
            artist = re.sub("[^A-Za-z0-9\s]", "", artist)
            if artist.lower() == artist_result.lower():
                lyrics = tree.findtext('{http://api.chartlyrics.com/}Lyric')
                if lyrics:
                    resp.lyrics = lyrics.replace("\n", "<br/>")
                    resp.success = True
                url = tree.findtext('{http://api.chartlyrics.com/}LyricUrl')
                if url:
                    resp.url = url
    except Exception, e:
        traceback.print_exc()
    return resp


def find_LyricsFly(title, artist=''):
    resp = LyricsResponse('LyricsFly')
    url = "http://api.lyricsfly.com/api/api.php"
    url += "?i=8890a06f973057f4b-addons.mozilla.org/en-US/firefox/addon/6324"
    title_only = url + '&t=' + re.sub("[^A-Za-z0-9\s]", "%", title)
    if artist:
        artist_url = title_only + '&a=' + re.sub("[^A-Za-z0-9\s]", "%", artist)

    xml = fetch(re.sub("\s", "%20", artist_url))
    try:
        tree = cETree.XML(xml)
        lyrics = tree.findtext('sg/tx')
        if lyrics is None:
            # Try again with title only
            xml = fetch(re.sub("\s", "%20", title_only))
            tree = cETree.XML(xml)
            lyrics = tree.findtext('sg/tx')
        if lyrics is not None:
            resp.lyrics = lyrics.replace("[br]", "<br>")
            resp.success = True
            cs = tree.findtext('sg/cs')
            id = tree.findtext('sg/id')
            if cs and id:
                resp.url = "http://lyricsfly.com/search/correction.php?"
                resp.url += cs
                resp.url += "&id=" + id
    except Exception, e:
        traceback.print_exc()

    return resp


def find_LyricsPlugin(title, artist):
    resp = LyricsResponse('LyricsPlugin.WinAmp')
    try:
        artist = urllib.quote_plus(artist.strip())
        title = urllib.quote_plus(title.strip())
        vars = "?artist=%s&title=%s" % (artist,title)
        resp.url = "http://www.lyricsplugin.com/winamp03/edit/" + vars
        link = "http://www.lyricsplugin.com/winamp03/plugin/" + vars
        text = fetch(link)
        soup = BeautifulSoup(text)
        div = soup.find("div", id="lyrics")
        if div:
            resp.lyrics = str(div)
            resp.success = True
    except Exception, e:
        traceback.print_exc()
    return resp
    
    
def find_LyricsAstraWeb(title, artist):
    resp = LyricsResponse('LyricsAstraWeb')
    try:
        artist_find = urllib.quote_plus(artist.lower().strip())
        title_find = urllib.quote_plus(title.lower().strip())
        link = "http://search.lyrics.astraweb.com/?word=%s+%s" % (artist_find,title_find)
        text = fetch(link)
        soup = BeautifulSoup(text)
        t = soup.findAll('a', href=re.compile('^/display/[0-9].*'))
        if t:
            link = t[0]['href']
            url = "http://lyrics.astraweb.com" + link
            resp.url = url
            lyrics = fetch(url)
            soup = BeautifulSoup(lyrics)
            t = soup.findAll('font')
            if len(t) > 2:
                resp.lyrics = str(t[2])
                resp.success = True
    except Exception, e:
        traceback.print_exc()
    return resp
