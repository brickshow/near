// Run with Vite on :1420 and agent-browser installed. No native access is granted:
// the production React component is exercised with Tauri's official IPC mock.
import { execFileSync } from 'node:child_process';
const session = execFileSync('agent-browser', ['session','id','--scope','worktree','--prefix','near-access-tests'], { encoding:'utf8' }).trim();
function browser(...args) { return execFileSync('agent-browser', ['--session',session,...args], { encoding:'utf8', timeout:40000 }); }
function evaluate(source) {
  return execFileSync('agent-browser', ['--session',session,'eval','--stdin'], { input:`(async()=>{${source}})()`, encoding:'utf8', timeout:40000 });
}
try {
  browser('--args','--no-sandbox','open','http://127.0.0.1:1420/?window=settings');
  browser('wait','[aria-label="NEAR access"]');
  evaluate(`
    const { mockIPC } = await import('/node_modules/@tauri-apps/api/mocks.js');
    window.isTauri=true;
    window.testAccess={state:'preview_expired',activatedAt:100,expiresAt:259300,serverNow:259301,remainingSeconds:0,verified:true,activationsEnabled:true,message:''};
    window.testCalls=[];
    mockIPC((cmd,args)=>{window.testCalls.push({cmd,args,at:performance.now()});
      if(cmd==='access_refresh' && args.activate && window.testAccess.state==='preview_not_activated') window.testAccess={...window.testAccess,state:'preview_active',activatedAt:100,expiresAt:259300,serverNow:101,remainingSeconds:259199};
      if(cmd==='access_status'||cmd==='access_refresh') return window.testAccess;
      if(cmd==='access_export_data') return true;
    },{shouldMockEvents:true});
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { AccessGate } = await import('/src/components/AccessGate.tsx');
    const fixture=document.createElement('div');document.body.replaceChildren(fixture);
    window.testRoot=ReactDOM.createRoot(fixture);
    window.testRoot.render(React.createElement(AccessGate,null,React.createElement('p',{id:'primary-features'},'PRIMARY FEATURES')));
  `);
  browser('wait','--text',"Your journey doesn't have to end here.");
  evaluate(`if(document.querySelector('#primary-features')) throw Error('Expired primary features mounted');`);
  browser('click','.access-actions > button:first-child');
  evaluate(`if(!window.testCalls.some(c=>c.cmd==='access_open_landing')) throw Error('Missing native browser command');`);
  browser('click','.access-actions .access-link');
  browser('click','.access-actions > button:first-child');
  browser('wait','--text','Your personal data was exported.');
  browser('click','.access-secondary');
  evaluate(`if(window.testCalls.some(c=>c.cmd==='access_delete_data')) throw Error('Deleted before confirmation');`);
  browser('click','.access-secondary');
  browser('wait','--text','Your personal data was deleted.');
  browser('click','.access-actions .access-link:last-child');
  evaluate(`window.testAccess={...window.testAccess,state:'preview_active',remainingSeconds:200};`);
  browser('wait','#primary-features');
  evaluate(`window.testAccess={...window.testAccess,state:'preview_expired',remainingSeconds:0};`);
  browser('wait','--text',"Your journey doesn't have to end here.");
  evaluate(`if(document.querySelector('#primary-features')) throw Error('Features survived expiry');`);
  evaluate(`window.testAccess={...window.testAccess,state:'preview_active',remainingSeconds:200,verified:false,message:'Verification unavailable'};`);
  browser('wait','--text','Verification unavailable');
  evaluate(`if(document.querySelector('#primary-features')) throw Error('Unverified features mounted');`);
  evaluate(`
    window.testRoot.unmount(); window.testCalls=[]; window.testStartedAt=performance.now();
    window.testAccess={...window.testAccess,state:'preview_not_activated',verified:true,serverNow:0,message:''};
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { AccessGate } = await import('/src/components/AccessGate.tsx');
    const fixture=document.createElement('div'); document.body.replaceChildren(fixture);
    window.testRoot=ReactDOM.createRoot(fixture);
    window.testRoot.render(React.createElement(AccessGate,null,React.createElement('p',{id:'primary-features'},'PRIMARY FEATURES')));
  `);
  browser('wait','--text','Seventy-two hours.');
  evaluate(`if(window.testCalls.some(c=>c.cmd==='access_refresh' && c.args.activate)) throw Error('Activated before disclosure');`);
  browser('wait','#primary-features');
  evaluate(`const activation=window.testCalls.find(c=>c.cmd==='access_refresh' && c.args.activate); if(!activation || activation.at-window.testStartedAt<6000) throw Error('Missing automatic activation after disclosure');`);
  console.log('Access UI PASS: automatic first-launch activation after disclosure, expiry lock, native landing command, export, confirmed delete, active mount, expiration unmount, network lock. IPC is mocked.');
} finally { browser('close'); }
