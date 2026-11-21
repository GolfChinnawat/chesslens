from playwright.sync_api import sync_playwright, expect
import base64,json,time,os
id='8d7be724-a9f0-4f3e-a854-edf652e2ec94'
def encode(data): return base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip('=')
user={'id':id,'aud':'authenticated','email':'alice@example.test','app_metadata':{},'user_metadata':{},'created_at':'2026-01-01T00:00:00Z'}
jwt=encode({'alg':'HS256','typ':'JWT'})+'.'+encode({'sub':id,'exp':int(time.time())+3600,'role':'authenticated'})+'.signature'
saved=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHESSLENS_CHROMIUM'),args=['--no-sandbox','--no-zygote'])
 page=browser.new_page(viewport={'width':1280,'height':800})
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 def supa(route):
  request=route.request
  path=request.url.split('?')[0]
  headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET, POST, OPTIONS'}
  if request.method=='OPTIONS': route.fulfill(status=204,headers=headers); return
  if path.endswith('/signup'): result={'user':user}
  elif path.endswith('/token'): result={'access_token':jwt,'refresh_token':'mock-refresh','expires_in':3600,'token_type':'bearer','user':user}
  elif path.endswith('/settings'): result=[{'display_name':'Alice'}]
  elif path.endswith('/mistake_positions'): result=[]
  elif path.endswith('/games'): result=saved
  elif path.endswith('/rpc/save_review'):
   args=request.post_data_json
   assert request.headers['authorization']=='Bearer '+jwt
   assert len(args['review_payload']['positions'])==5
   saved.append(dict(id=id,pgn=args['game_pgn'],result=args['game_result'],opening=args['game_opening'],saved_at='2026-01-01',played_at=None,reviews=[dict(depth=12,payload=args['review_payload'])]))
   result=id
  else: raise AssertionError(path)
  route.fulfill(json=result,headers=headers)
 page.route('https://chesslens-test.supabase.co/**',supa)
 page.goto(os.environ.get('CHESSLENS_TEST_URL','http://127.0.0.1:4184/')+'?view=account')
 page.get_by_role('button',name='สร้างบัญชีใหม่').click()
 page.get_by_label('อีเมล').fill('alice@example.test')
 page.get_by_label('รหัสผ่าน').fill('test-only-password')
 page.get_by_role('button',name='สมัครสมาชิก',exact=True).click()
 expect(page.get_by_role('status')).to_have_text('ตรวจอีเมลเพื่อยืนยันบัญชี')
 page.get_by_role('button',name='กลับไปเข้าสู่ระบบ').click()
 page.get_by_label('อีเมล').fill('alice@example.test')
 page.get_by_label('รหัสผ่าน').fill('test-only-password')
 page.get_by_role('button',name='เข้าสู่ระบบ',exact=True).click()
 expect(page.get_by_role('heading',name='คลังเกมของฉัน')).to_be_visible()
 page.get_by_role('link',name='รีวิวเกม').click()
 page.get_by_label('วางข้อความ PGN').fill('[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 2. Nf3 Nc6 1-0')
 page.get_by_role('button',name='นำเข้าเกม',exact=True).click()
 page.get_by_label('ความลึก').select_option('12')
 page.get_by_role('button',name='เริ่มวิเคราะห์').click()
 page.get_by_role('button',name='บันทึกเข้าคลังเกม').click(timeout=30000)
 expect(page.get_by_text('บันทึกในคลังเกมแล้ว')).to_be_visible()
 page.get_by_role('link',name='บัญชีและคลังเกม').click()
 expect(page.get_by_role('button',name='เปิดรีวิว')).to_be_visible()
 expect(page.get_by_text('ขาว ชนะ / เสมอ / แพ้:',exact=False)).to_contain_text('1 / 0 / 0')
 page.get_by_role('button',name='เปิดรีวิว').click()
 expect(page.get_by_role('region',name='กระดานรีวิวเกม')).to_be_visible()
 assert not errors,errors
 print('Passed signup confirmation UI, login, PGN, Stockfish, bearer-authenticated save, dashboard and reopening saved review')
