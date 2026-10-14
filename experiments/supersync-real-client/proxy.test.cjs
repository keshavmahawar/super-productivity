const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
test('proxy retains auth, rejects browser origin and hostile Host, fails closed without client', async () => {
  const backend = http.createServer((req, res) => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({host:req.headers.host, authorization:req.headers.authorization, path:req.url})); });
  await new Promise(resolve => backend.listen(3876,'127.0.0.1',resolve));
  const child = spawn(process.execPath,[require('node:path').join(__dirname,'proxy.cjs')],{stdio:'ignore',env:{...process.env,PROXY_TEST_LOOPBACK:'1'}});
  try {
    let response;
    for(let i=0;i<100;i++) { try { response=await fetch('http://127.0.0.1:3877/tasks',{headers:{authorization:'Bearer synthetic-test'}}); break; } catch { await new Promise(r=>setTimeout(r,30)); } }
    assert.ok(response); assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{host:'127.0.0.1:3876',authorization:'Bearer synthetic-test',path:'/tasks'});
    assert.equal((await fetch('http://127.0.0.1:3877/tasks',{headers:{origin:'https://untrusted.invalid'}})).status,403);
    const hostile = await new Promise((resolve,reject)=>{http.get('http://127.0.0.1:3877/tasks',{headers:{host:'attacker.invalid'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});
    assert.equal(hostile,403);
    await new Promise(r=>backend.close(r));
    assert.equal((await fetch('http://127.0.0.1:3877/tasks')).status,503);
  } finally { child.kill(); await new Promise(r=>child.once('exit',r)); backend.close(); }
});
