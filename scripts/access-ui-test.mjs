// Run with Vite on :1420 and agent-browser installed. No native access is granted:
// the production React component is exercised with Tauri's official IPC mock.
import { execFileSync } from 'node:child_process';
const agentBrowser = process.env.AGENT_BROWSER_BIN || 'agent-browser';
const session = execFileSync(agentBrowser, ['session','id','--scope','worktree','--prefix','near-access-tests'], { encoding:'utf8' }).trim();
function browser(...args) { return execFileSync(agentBrowser, ['--session',session,...args], { encoding:'utf8', timeout:40000 }); }
function evaluate(source) {
  return execFileSync(agentBrowser, ['--session',session,'eval','--stdin'], { input:`(async()=>{${source}})()`, encoding:'utf8', timeout:40000 });
}
try {
  browser('--args','--no-sandbox','open','http://127.0.0.1:1420/?window=settings');
  browser('wait','[aria-label="NEAR access"]');
  evaluate(`
    const { mockIPC } = await import('/node_modules/@tauri-apps/api/mocks.js');
    window.isTauri=true;
    window.testAccess={remainingSeconds:0};
    window.testCalls=[];
    mockIPC((cmd,args)=>{window.testCalls.push({cmd,args});
      if(cmd==='access_activate') {
        window.testAccess ??= {remainingSeconds:259200};
        return window.testAccess;
      }
      if(cmd==='access_status') return window.testAccess;
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
  evaluate(`window.testAccess={remainingSeconds:200};`);
  browser('wait','#primary-features');
  evaluate(`window.testAccess={remainingSeconds:0};`);
  browser('wait','--text',"Your journey doesn't have to end here.");
  evaluate(`if(document.querySelector('#primary-features')) throw Error('Features survived expiry');`);
  evaluate(`
    window.testRoot.unmount(); window.testCalls=[];
    window.testAccess=null;
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { AccessGate } = await import('/src/components/AccessGate.tsx');
    const fixture=document.createElement('div'); document.body.replaceChildren(fixture);
    window.testRoot=ReactDOM.createRoot(fixture);
    window.testRoot.render(React.createElement(AccessGate,null,React.createElement('p',{id:'primary-features'},'PRIMARY FEATURES')));
  `);
  browser('wait','#primary-features');
  evaluate(`if(!window.testCalls.some(c=>c.cmd==='access_activate') || window.testAccess.remainingSeconds!==259200) throw Error('Missing automatic 72-hour preview activation');`);
  console.log('Access UI PASS: automatic first-launch activation, expiry lock, native landing command, export, confirmed delete, active mount, and expiration unmount. IPC is mocked.');
} finally { browser('close'); }
