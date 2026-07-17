const crypto = require('crypto');
const botToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
const checkString = `auth_date=1662771648
query_id=AAHdF6IQAAAAAN0XohDhrOrc
user={"id":279058397,"first_name":"Vladislav","last_name":"Radchenko","username":"vladislavradchenko","language_code":"ru"}`;
const expected = 'c501b71e775f74ce10e377dea85a7ea24ecd640b223ea86dfe453e0eaed2e2b2';

// 1: key=WebAppData, data=botToken
const secretKey1 = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
const hash1 = crypto.createHmac('sha256', secretKey1).update(checkString).digest('hex');
console.log('Test 1 (key=WebAppData, data=botToken):', hash1, hash1 === expected);

// 2: key=botToken, data=WebAppData
const secretKey2 = crypto.createHmac('sha256', botToken).update('WebAppData').digest();
const hash2 = crypto.createHmac('sha256', secretKey2).update(checkString).digest('hex');
console.log('Test 2 (key=botToken, data=WebAppData):', hash2, hash2 === expected);

