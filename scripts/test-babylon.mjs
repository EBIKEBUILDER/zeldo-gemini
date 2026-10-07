import { spawn } from 'child_process';
import http from 'http';

// We can query chrome devtools or run chrome with remote debugging
console.log('Testing dev server response...');
http.get('http://localhost:3000', (res) => {
  console.log('HTTP Status:', res.statusCode);
});
