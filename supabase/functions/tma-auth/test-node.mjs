import crypto from 'crypto';

const botToken = '5768337691:AAH5YkoiEuPk8-FZa32hStHTqXiLPtAEhx8';
const initDataEncoded = 'query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%22%2C%22last_name%22%3A%22Radchenko%22%2C%22username%22%3A%22vladislavradchenko%22%2C%22language_code%22%3A%22ru%22%7D&auth_date=1662771648&hash=c501b71e775f74ce10e377dea85a7ea24ecd640b223ea86dfe453e0eaed2e2b2';
const expected = 'c501b71e775f74ce10e377dea85a7ea24ecd640b223ea86dfe453e0eaed2e2b2';

const params = new URLSearchParams(initDataEncoded);
const hash = params.get('hash');
params.delete('hash');
const checkArr = [];
params.sort();
params.forEach((val, key) => checkArr.push(`${key}=${val}`));
const checkString = checkArr.join('\n');

const secretKey1 = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
const hash1 = crypto.createHmac('sha256', secretKey1).update(checkString).digest('hex');
console.log('Hash matched expected?', hash1 === expected);

