import hashlib, re, urllib, os, time
from xml.etree import ElementTree as ET
from datetime import datetime, timedelta

class CoverSearch():
    """
        Searches for covers from amazon.com (via musicbrainz.org),
        then Last.fm.  If neither return a valid album image, an
        artist image from last.fm will be used.
    """

    def __init__(self, cover_dir=None):
        if cover_dir is not None:
            self.cover_dir = cover_dir
        else:
            self.cover_dir = os.path.expanduser(os.path.join('~','.Covers'))
            
        if not os.path.exists(self.cover_dir):
            os.makedirs(self.cover_dir)
            
        self.urlMB = 'http://musicbrainz.org/ws/1/release/?type=xml&title=%(album)s&artist=%(artist)s&limit=1'
        self.regexMB = re.compile('\<asin\>([^\<]*)\<\/asin\>', re.IGNORECASE)
        
        self.urlFM = "http://ws.audioscrobbler.com/1.0/album/%(artist)s/%(album)s/info.xml"

        self.urlFM_artist = "http://ws.audioscrobbler.com/1.0/artist/%s/similar.xml"
        self.regexFM_artist = re.compile('picture\=\"([^\"]*)\"', re.IGNORECASE)

        self.delta = timedelta(seconds=1)


    def _delay(self, timeVar):
        # Be kind, don't make more than one request per second to
        # each service.
        lastSearch = self.__dict__.get(timeVar, None)
        if lastSearch:
            n = datetime.utcnow()
            dif = n - lastSearch
            while dif < self.delta:
                time.sleep(0.1)
                n = datetime.utcnow()
                dif = n - self.__dict__[timeVar]
        self.__dict__[timeVar] = datetime.utcnow()


    def _findMusicBrainz(self, vars):
        self._delay('lat_MB_lookup')
        data = urllib.urlopen(self.urlMB % vars).read()
        m = self.regexMB.search(data)
        if not m:
            return False
        else:
            asin = m.group(1)
            url = "http://images.amazon.com/images/P/%s.01.%sZZZZZZZ.jpg"
            for sz in ['L', 'M']:
                image = url % (asin, sz)
                h = urllib.urlopen(image)
                data = h.read()
                h.close()
                if len(data) > 1000:
                    return data
        return False
    

    def _findLastFM_album(self, vars):
        self._delay('lat_FM_lookup')
        data = urllib.urlopen(self.urlFM % vars).read()
        x = ET.XML(data)
        if not x:
            print 'LASTFM SEARCH: ERROR PARSING LASTFM DATA!'
            return False
            
        c = x.find('coverart')
        if not c:
            print 'LASTFM SEARCH: NO COVERART NODE IN LASTFM DATA!'
            return False

        for sz in ['large', 'medium', 'small']:
            image = c.findtext(sz, '')
            if image > '' and not image.lower().endswith('.gif'):
                h = urllib.urlopen(image)
                data = h.read()
                h.close()
                if hashlib.sha1(data).hexdigest() != "57b2c37343f711c94e83a37bd91bc4d18d2ed9d5":
                    return data
                else:
                    print 'LASTFM SEARCH: Blacklisted image returned.'

        return False


    def _findLastFM_artist(self, vars):
        self._delay('lat_FM_lookup')
        data = urllib.urlopen(self.urlFM_artist % vars['artist']).read()
        m = self.regexFM_artist.search(data)
        if not m:
            return False
        else:
            image = m.group(1)
            if image.lower().endswith('.gif'):
                return False
            h = urllib.urlopen(image)
            data = h.read()
            h.close()
            return data
            

    def find(self, artist=None, album=None):
        if not artist:
            return False
            
        if album:
            covername = '%s - %s.jpg' % (artist, album)
            lookups = [
                self._findMusicBrainz,
                self._findLastFM_album,
                self._findLastFM_artist
            ]
        else:
            album = ''
            covername = '%s.jpg' % artist
            lookups = [self._findLastFM_artist]
            
        coverpath = os.path.join(self.cover_dir, covername)
        if os.path.isfile(coverpath):
            return covername
            
        vars = {
            'album': urllib.quote_plus(album.encode("utf-8")),
            'artist': urllib.quote_plus(artist.encode("utf-8"))
        }

        for fn in lookups:
            try:
                data = fn(vars)
                if data:
                    h = open(coverpath, 'w')
                    h.write(data)
                    h.close()
                    return covername
            except:
                pass

        return False

