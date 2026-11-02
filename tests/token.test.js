import {RequestToken} from '../src/core/token.js';

function check(condition, message) {
  if (!condition)
    throw new Error(`FAIL: ${message}`);
}

const token = new RequestToken();
const first = token.next();
check(token.isCurrent(first), 'new request is current');
check(!token.isCurrent(first + 1), 'unknown request is stale');

token.invalidate();
check(!token.isCurrent(first), 'invalidate makes old request stale');
check(token.isCurrent(token.next()), 'next request becomes current');

print('token.js OK');
