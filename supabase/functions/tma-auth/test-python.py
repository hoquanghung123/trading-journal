import hashlib
import hmac
from urllib.parse import parse_qsl

init_data = "query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%22%2C%22last_name%22%3A%22Radchenko%22%2C%22username%22%3A%22vladislavradchenko%22%2C%22language_code%22%3A%22ru%22%7D&auth_date=1662771648&hash=c501b71e775f74ce10e377dea85a7ea24ecd640b223ea86dfe453e0eaed2e2b2"
bot_token = "5768337691:AAH5YkoiEuPk8-FZa32hStHTqXiLPtAEhx8"
expected = "c501b71e775f74ce10e377dea85a7ea24ecd640b223ea86dfe453e0eaed2e2b2"

parsed_data = dict(parse_qsl(init_data, keep_blank_values=True))
hash_value = parsed_data.pop('hash', None)

data_check_string = '\n'.join(
    f"{k}={v}" for k, v in sorted(parsed_data.items())
)

secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

print("Match:", calculated_hash == expected)
print("Hash:", calculated_hash)
print("Data check string:", repr(data_check_string))
