const botToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
const initData = 'query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%22%2C%22last_name%22%3A%22Radchenko%22%2C%22username%22%3A%22vladislavradchenko%22%2C%22language_code%22%3A%22ru%22%7D&auth_date=1662771648&hash=c501b71e775f74ce10e377dea85a7ea24ecd640b223ea86dfe453e0eaed2e2b2';

async function verifyTelegramInitData(initData: string, botToken: string): Promise<boolean> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');
  const checkArr: string[] = [];
  params.sort();
  params.forEach((val, key) => checkArr.push(`${key}=${val}`));
  const checkString = checkArr.join('\n');
  
  console.log('checkString:\n' + checkString);

  const encoder = new TextEncoder();
  const secretKeyData = await crypto.subtle.importKey(
    'raw', encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const secretKey = await crypto.subtle.sign('HMAC', secretKeyData, encoder.encode(botToken));
  const hmacKey = await crypto.subtle.importKey(
    'raw', secretKey,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(checkString));
  const expectedHash = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  console.log(`expectedHash=${expectedHash} hash=${hash}`);
  return expectedHash === hash;
}

verifyTelegramInitData(initData, botToken).then(console.log);
