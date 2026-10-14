// Disposable CI profile only. No account or real encryption keys are configured.
const {chromium,expect}=require('/app/node_modules/@playwright/test');
const fs=require('node:fs');
(async()=>{
 let browser;
 for(let i=0;i<120;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9222');break;}catch{await new Promise(r=>setTimeout(r,500));}}
 if(!browser)throw Error('Production Electron did not start with sandbox enabled');
 const page=browser.contexts().flatMap(c=>c.pages()).find(p=>!p.url().startsWith('devtools:'));
 await page.waitForLoadState('domcontentloaded');
 await page.evaluate(()=>{for(const k of ['SUP_ONBOARDING_PRESET_DONE','SUP_ONBOARDING_HINTS_DONE','SUP_IS_SHOW_TOUR','SUP_EXAMPLE_TASKS_CREATED'])localStorage.setItem(k,'true');});
 const initialHydration=page.waitForEvent('console',{predicate:m=>m.text().includes('[SP_ALL] All Data was loaded'),timeout:30000});
 await page.reload({waitUntil:'domcontentloaded'});
 await initialHydration;
 await page.locator('.route-wrapper').first().waitFor({state:'visible',timeout:60000});
 await page.evaluate(()=>{location.hash='/config';});
 // Use the real settings UI; never force-enable the API or mutate app databases.
 const misc=page.locator('.section-misc');
 if(!await misc.isVisible()){
   const advanced=page.getByRole('tab',{name:/advanced/i});
   if(await advanced.count())await advanced.click();
 }
 await misc.waitFor({state:'visible',timeout:15000});
 const collapsible=misc.locator('collapsible');
 if(!await collapsible.evaluate(e=>e.classList.contains('isExpanded')))await collapsible.locator('.collapsible-header').click();
 await misc.locator('.collapsible-panel').waitFor({state:'visible'});
 // ConfigForm transforms checkbox fields into Material slide toggles (role=switch).
 const apiToggle=misc.getByRole('switch',{name:'Enable local REST API (desktop only)'});
 await apiToggle.waitFor({state:'visible'});
 if(await apiToggle.getAttribute('aria-checked')!=='true')await apiToggle.click();
 await expect(apiToggle).toHaveAttribute('aria-checked','true');
 let token;
 for(let i=0;i<100;i++){try{token=fs.readFileSync('/data/profile/local-rest-api-token','utf8').trim();if(token)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 if(!token)throw Error('Native API token was not persisted');
 const api=async(path,init={})=>fetch('http://127.0.0.1:3877'+path,{...init,headers:{authorization:'Bearer '+token,'content-type':'application/json',...init.headers}});
 expect((await fetch('http://127.0.0.1:3877/tasks')).status).toBe(401);
 const operationPersisted=page.waitForEvent('console',{predicate:m=>m.text().includes('OperationCaptureService: Processed action'),timeout:20000});
 const created=await api('/tasks',{method:'POST',body:JSON.stringify({title:'Disposable container smoke',projectId:'INBOX_PROJECT',isIgnoreShortSyntax:true})});
 expect(created.ok).toBeTruthy();
 const tasks=await api('/tasks');expect(tasks.ok).toBeTruthy();
 expect(await tasks.text()).toContain('Disposable container smoke');
 // Match upstream packaged-app smoke: wait for durable operation write before reload.
 await operationPersisted;
 const rehydrated=page.waitForEvent('console',{predicate:m=>m.text().includes('[SP_ALL] All Data was loaded'),timeout:30000});
 await page.reload({waitUntil:'domcontentloaded'});
 await rehydrated;
 await expect.poll(async()=>await (await api('/tasks')).text(),{timeout:20000}).toContain('Disposable container smoke');
 console.log('Production Electron GUI/native REST create and reload smoke passed. Sync-account interoperability is not covered.');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
