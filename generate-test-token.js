const jwt = require('jsonwebtoken');

const JWT_SECRET = 'local-development-secret-change-in-production';

const user = {
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User'
};

const token = jwt.sign({
  sub: user.id,
  email: user.email,
  name: user.name
}, JWT_SECRET, {
  expiresIn: '1h'
});

console.log('Generated JWT Token:');
console.log(token);
console.log('\nDecoded payload:');
console.log(jwt.decode(token));