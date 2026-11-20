"""Supported unattended check. Credentials are accepted on stdin, never persisted."""
import json, sys, urllib.request
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None
saved = None
if sys.stdin.isatty():
    import termios
    saved = termios.tcgetattr(sys.stdin)
    hidden = list(saved)
    hidden[3] &= ~termios.ECHO
    termios.tcsetattr(sys.stdin, termios.TCSANOW, hidden)
print('Ready for private notification check JSON on stdin (input is hidden).', flush=True)
try:
    config = json.loads(sys.stdin.readline())
finally:
    if saved is not None:
        termios.tcsetattr(sys.stdin, termios.TCSANOW, saved)
origin = config['origin'].rstrip('/')
if not origin.startswith('https://') or '/' in origin[8:]:
    raise ValueError('Provide the HTTPS origin of the NEW application only')
request = urllib.request.Request(origin + '/api/notifications/check', data=json.dumps({'dryRun': config.get('dryRun', True)}).encode(), headers={'Content-Type':'application/json','OAI-Sites-Authorization':'Bearer ' + config['token']}, method='POST')
try:
    with urllib.request.build_opener(NoRedirect).open(request, timeout=35) as response:
        result = json.load(response)
    print(json.dumps(result, ensure_ascii=False))
except Exception as error:
    print(json.dumps({'error': str(error)}))
    sys.exit(1)
