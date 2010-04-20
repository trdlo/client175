import re, urllib

try:
    import xml.etree.cElementTree as cETree
except:
    import cElementTree as cETree


class LyricsResponse(object):
    def __init__(self, responder=''):
        self.lyrics = ''
        self.responder = responder
        self.url = ''



def find(title, artist=''):
    return find_lyric_wiki(track)


def find_lyric_wiki(title, artist=''):
    resp = LyricsResponse('LyricsFly')

    url = "http://api.lyricsfly.com/api/api.php"
    url += "?i=8890a06f973057f4b-addons.mozilla.org/en-US/firefox/addon/6324"
    url += '&t=' + re.sub("[^A-Za-z0-9]", "%", title)
    if artist:
        url += '&a=' + re.sub("[^A-Za-z0-9]", "%", artist)

    sock = urllib.urlopen(url)
    xml = sock.read()
    sock.close()

    try:
        tree = cETree.XML(xml)
        lyrics = tree.findtext('sg/tx')
        if lyrics is None:
            resp.lyrics = "Not Found"
        else:
            resp.lyrics = lyrics.replace("[br]", "").replace(" &#169;", "Copyright ")
        resp.url = "http://lyricsfly.com/search/correction.php?"
        resp.url += tree.findtext('sg/cs')
        resp.url += "&id=" + tree.findtext('sg/id')
    except Exception, e:
        print e
        resp.lyrics = 'Not found'
        resp.url = ''

    return resp
