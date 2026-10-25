/* MIYAN_GATE_V2_INTEGRATION: client implementation adapted from uploaded miyan.html.
   Server responses are signature-verified before AES decryption. */
(function(){
  'use strict';
  var CFG={apiKey:'e2fc40d0e26cedefaff32b0c94650f41',keyId:'d9f25058c4d2480d28b1cf58280803a0',authUrl:'https://my.b6w.cn/api/AuthV2.php',updateUrl:'https://my.b6w.cn/api/UpdateV2.php',version:'1.0.0',publicKey:'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqafG30bGsBukQydkY2F6KLOiBJ5cdzFt/Yj5SeE/O5weABX/GU9Ild/ofP+//mY85krNo3u5T+Je5974ka4OoFVNIz7ZjlfMulGVEYLA0EoNav1kzLEy/WJwqpLWWx/TWXu+DhaVNfBOwXT8rmMbLANH7gamjP2oN9slX9gr0Tkzd7BcEvWB0NhIVhOYdHQbPsO1ACIRl2uJpUow72uGMqFsn3C1b5bVqofTif92M6YHCWhhNvumkdbzZMpTFqjYNvgTEU1Y4mJRsh3sQDdKUppv5gTxGWLvbVytkPYaZe/ly9zDU7um33zHzP6qMSsfDM5sckXNhtd7sJsozqaT4QIDAQAB'};
  var $=function(id){return document.getElementById(id)};
  var gate=$('miYanGate'),input=$('miYanCardKey'),status=$('miYanStatus'),verifyBtn=$('miYanVerify'),unbindBtn=$('miYanUnbind');
  var pem=CFG.publicKey.indexOf('-----BEGIN')>=0?CFG.publicKey:'-----BEGIN PUBLIC KEY-----\n'+CFG.publicKey+'\n-----END PUBLIC KEY-----';
  function say(msg,type){status.textContent=msg;status.className='miyan-status'+(type?' '+type:'')}
  function busy(on,label){verifyBtn.disabled=unbindBtn.disabled=!!on;verifyBtn.textContent=on?(label||'处理中…'):'验证并进入';}
  function nonce(len){var chars='abcdefghijklmnopqrstuvwxyz0123456789',out='',a=new Uint8Array(len);crypto.getRandomValues(a);for(var i=0;i<len;i++)out+=chars[a[i]%chars.length];return out}
  function deviceId(){var id=localStorage.getItem('miyan_device_id');if(!id){id=nonce(32);localStorage.setItem('miyan_device_id',id)}return id}
  function randomBytes(len){var a=new Uint8Array(len);crypto.getRandomValues(a);return a}
  function b64(a){var s='';for(var i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s)}
  function fromB64(s){var t=atob(s),a=new Uint8Array(t.length);for(var i=0;i<t.length;i++)a[i]=t.charCodeAt(i);return a}
  function hex(a){return Array.from(a).map(function(x){return ('0'+x.toString(16)).slice(-2)}).join('')}
  function enc(s,key,iv){return CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(s),CryptoJS.enc.Hex.parse(hex(key)),{iv:CryptoJS.enc.Hex.parse(hex(iv)),mode:CryptoJS.mode.CBC,padding:CryptoJS.pad.Pkcs7}).toString()}
  function dec(s,key,iv){var out=CryptoJS.AES.decrypt(s,CryptoJS.enc.Hex.parse(hex(key)),{iv:CryptoJS.enc.Hex.parse(hex(iv)),mode:CryptoJS.mode.CBC,padding:CryptoJS.pad.Pkcs7}).toString(CryptoJS.enc.Utf8);if(!out)throw new Error('解密结果为空');return out}
  function rsaEncrypt(bytes){var j=new JSEncrypt();j.setPublicKey(pem);var k=j.getKey();if(!k||!k.n)throw new Error('RSA 公钥初始化失败');var n=k.n,kl=(n.bitLength()+7)>>3;if(bytes.length>kl-11)throw new Error('RSA 数据长度超限');var ba=new Array(kl);ba[0]=0;ba[1]=2;var pad=kl-bytes.length-3,pos=2,ra=randomBytes(pad);for(var i=0;i<pad;i++){var r=ra[i];while(r===0)r=randomBytes(1)[0];ba[pos++]=r}ba[pos++]=0;for(var z=0;z<bytes.length;z++)ba[pos++]=bytes[z];var BigInteger=n.constructor,m=new BigInteger(ba),c=k.doPublic(m);if(!c)throw new Error('RSA 加密失败');var cb=c.toByteArray(),res=[];for(var q=0;q<cb.length;q++){var v=cb[q];if(v<0)v+=256;res.push(v)}while(res.length<kl)res.unshift(0);while(res.length>kl&&res[0]===0)res.shift();return b64(new Uint8Array(res))}
  function verifyEnvelope(r,action,n){if(!r||r.status!==true||r.encrypted!==true||r.protocol!=='miyan-v2'||r.enc!=='A256CBC'||r.sig_version!==1||r.sig_alg!=='RS256')throw new Error('服务端响应格式或协议不正确');if(r.key_id!==CFG.keyId||r.request_action!==action||r.request_nonce!==n)throw new Error('响应关联校验失败');if(!Number.isInteger(r.server_timestamp)||Math.abs(r.server_timestamp-Date.now()/1000)>300)throw new Error('响应时间戳无效');if(typeof r.iv!=='string'||typeof r.data!=='string'||typeof r.signature!=='string')throw new Error('加密响应字段缺失');var iv=fromB64(r.iv);if(iv.length!==16)throw new Error('响应 IV 长度错误');var payload=['MIYAN-V2-RESPONSE-SIGNATURE','protocol=miyan-v2','enc=A256CBC','sig_version=1','sig_alg=RS256','key_id='+r.key_id,'request_action='+r.request_action,'request_nonce='+r.request_nonce,'server_timestamp='+r.server_timestamp,'iv='+r.iv,'data='+r.data].join('\n');var v=new JSEncrypt();v.setPublicKey(pem);if(!v.verify(payload,r.signature,CryptoJS.SHA256))throw new Error('服务端签名验证失败');return iv}
  function post(url,body){return new Promise(function(resolve,reject){var x=new XMLHttpRequest(),done=false;function finish(ok,val){if(done)return;done=true;ok?resolve(val):reject(val)}x.open('POST',url,true);x.timeout=15000;x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');x.onreadystatechange=function(){if(x.readyState===4){if(x.status<200||x.status>=300||!x.responseText)return finish(false,new Error('网络请求失败（HTTP '+x.status+'）'));try{finish(true,JSON.parse(x.responseText))}catch(e){finish(false,new Error('服务端返回内容不是有效 JSON'))}}};x.onerror=function(){finish(false,new Error('网络请求失败或跨域请求被拒绝'))};x.ontimeout=function(){finish(false,new Error('请求超时，请稍后重试'))};try{x.send(body)}catch(e){finish(false,e)}})}
  function formEncode(s){return encodeURIComponent(s).replace(/!/g,'%21').replace(/'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29').replace(/\*/g,'%2A').replace(/~/g,'%7E')}
  function request(action,bizAction,extra){var key=randomBytes(32),iv=randomBytes(16),nonceValue=nonce(20),biz=Object.assign({api_key:CFG.apiKey,action:bizAction,machine_id:deviceId(),timestamp:Math.floor(Date.now()/1000),nonce:nonceValue},extra||{});var ek=rsaEncrypt(key),ed=enc(JSON.stringify(biz),key,iv),body='action='+formEncode(action)+'&key_id='+formEncode(CFG.keyId)+'&encrypted_key='+formEncode(ek)+'&encrypted_data='+formEncode(ed)+'&iv='+formEncode(b64(iv));return post(CFG.authUrl,body).then(function(r){var responseIv=verifyEnvelope(r,bizAction,nonceValue);var data=JSON.parse(dec(r.data,key,responseIv));return {outer:r,data:data,nonce:nonceValue}})}
  var noticeOverlay=$('miYanNoticeOverlay'),noticeTitle=$('miYanNoticeTitle'),noticeContent=$('miYanNoticeContent'),noticeClose=$('miYanNoticeClose'),updateBtn=$('miYanUpdateBtn'),announcementBtn=$('announcementBtn'),gateAnnouncementBtn=$('gateAnnouncementBtn'),gateAnnouncementTitle=$('gateAnnouncementTitle'),gateAnnouncementSummary=$('gateAnnouncementSummary');
  var updateState={loaded:false,checking:false,data:null,force:false,url:''};
  function multiline(v){if(v===null||v===undefined||v==='null')return '';return String(v).replace(/<br\s*\/?\s*>/gi,'\n').replace(/\\r\\n|\\n|\\r/g,'\n').replace(/\r\n?/g,'\n').trim()}
  function safeUnlockOverflow(){document.body.style.overflow=(gate&&!gate.hidden)?'hidden':''}
  function hideNotice(){if(updateState.force)return;noticeOverlay.hidden=true;safeUnlockOverflow()}
  function openUpdateUrl(){if(updateState.url){window.open(updateState.url,'_blank','noopener,noreferrer');if(!updateState.force)hideNotice()}else{checkUpdate(true)}}
  function showNoticeDiagnostic(title,message){
    updateState.force=false;updateState.url='';
    noticeTitle.textContent=title||'公告与更新';noticeContent.textContent=message||'暂无公告或更新。';
    noticeClose.hidden=false;noticeClose.textContent='知道了';updateBtn.hidden=true;
    noticeOverlay.hidden=false;document.body.style.overflow='hidden';
  }
  function setGateAnnouncement(title,summary,state){
    if(gateAnnouncementTitle)gateAnnouncementTitle.textContent=title||'网站公告与更新';
    if(gateAnnouncementSummary)gateAnnouncementSummary.textContent=summary||'点击查看服务端公告与版本信息。';
    if(gateAnnouncementBtn){gateAnnouncementBtn.dataset.state=state||'idle';gateAnnouncementBtn.setAttribute('aria-label',(title||'网站公告与更新')+'：点击查看详情');}
  }
  function showUpdateMessage(d,manual){
    updateState.data=d;updateState.force=d.need_update===true&&d.force_update===1;updateState.url=typeof d.update_url==='string'?d.update_url.trim():'';
    var notice=multiline(d.notice),log=multiline(d.update_log),need=d.need_update===true,ver=String(d.latest_version||'').trim();
    if(notice){setGateAnnouncement('网站公告',notice.replace(/\s+/g,' ').slice(0,115)+(notice.length>115?'…':''),'notice')}
    else if(need){setGateAnnouncement(updateState.force?'需要更新':'发现新版本',((ver?'最新版本 v'+ver+'。':'')+(log||'点击查看更新说明。')).replace(/\s+/g,' ').slice(0,115),'update')}
    else{setGateAnnouncement('暂无公告或更新','暂未收到新的服务端公告；点击此处可重新检查。','idle')}
    if(!notice&&!need){if(manual)showNoticeDiagnostic('公告与更新','目前没有新公告或可用更新。');return}
    noticeTitle.textContent=notice?'网站公告':(updateState.force?'需要更新':'发现新版本'+(ver?' v'+ver:''));
    var pieces=[];if(notice)pieces.push(notice);if(need){if(notice)pieces.push('');pieces.push((updateState.force?'当前版本需要更新':'检测到可用更新')+(ver?'（最新版本：v'+ver+'）':'')+'。');if(log)pieces.push(log);if(updateState.force&&!updateState.url)pieces.push('服务端尚未配置更新链接，请联系管理员。')}
    noticeContent.textContent=pieces.join('\n');
    noticeClose.hidden=!!updateState.force;noticeClose.textContent=need&&!updateState.force?'暂不更新':'知道了';
    updateBtn.hidden=!need;updateBtn.textContent=(updateState.force&&!updateState.url)?'重新检查更新':'前往更新';
    /* Normal announcements live in the dedicated login tile on first entry. Forced updates remain blocking. */
    if(!manual&&!updateState.force)return;
    noticeOverlay.hidden=false;document.body.style.overflow='hidden';
  }
  function checkUpdate(manual){
    if(updateState.checking){if(manual)showNoticeDiagnostic('正在检查公告','公告 / 更新检查正在进行，请稍后再试。');return Promise.resolve(false)}updateState.checking=true;
    if(typeof JSEncrypt==='undefined'||typeof CryptoJS==='undefined'){updateState.checking=false;if(manual)showNoticeDiagnostic('公告检查失败','加密组件未加载。请检查网络后刷新页面。');return Promise.resolve(false)}
    var key,iv,nonceValue,biz,ek,ed,body;
    try{
      key=randomBytes(32);iv=randomBytes(16);nonceValue=nonce(20);
      biz={api_key:CFG.apiKey,action:'update',version:CFG.version,timestamp:Math.floor(Date.now()/1000),nonce:nonceValue};
      ek=rsaEncrypt(key);ed=enc(JSON.stringify(biz),key,iv);
      body='key_id='+formEncode(CFG.keyId)+'&encrypted_key='+formEncode(ek)+'&encrypted_data='+formEncode(ed)+'&iv='+formEncode(b64(iv));
    }catch(e){updateState.checking=false;if(manual)say('更新检查初始化失败：'+(e.message||'未知错误'),'err');return Promise.resolve(false)}
    return post(CFG.updateUrl,body).then(function(r){
      var responseIv=verifyEnvelope(r,'update',nonceValue),plain=dec(r.data,key,responseIv),d=JSON.parse(plain);
      if(typeof d.request_nonce!=='string'||d.request_nonce!==nonceValue||d.request_action!=='update'||typeof d.server_timestamp!=='number'||!Number.isFinite(d.server_timestamp)||Math.abs(d.server_timestamp-Date.now()/1000)>300)throw new Error('更新响应关联校验失败');
      if(d.status!==true||d.code!==1||typeof d.need_update!=='boolean'||(d.force_update!==0&&d.force_update!==1))throw new Error('更新响应数据不符合协议');
      updateState.loaded=true;showUpdateMessage(d,manual);return true;
    }).catch(function(e){if(manual){setGateAnnouncement('公告检查失败',(e.message||'请求失败')+'。可检查网络后重试。','error');showNoticeDiagnostic('公告检查失败',(e.message||'请求失败')+'。请检查网络、跨域设置或米验服务端配置。')}else console.warn('[米验公告] 公告检查失败，授权流程不受影响。',e);return false}).finally(function(){updateState.checking=false});
  }  function startApp(){if(window.__KA28_START_AFTER_AUTH&&!window.__KA28_STARTED){window.__KA28_STARTED=true;window.__KA28_START_AFTER_AUTH()}}
  function unlock(data,cardKey){var receipt=data.auth_receipt;if(!receipt){say('验证响应缺少授权凭据，请联系服务端管理员。','err');return}localStorage.setItem('miyan_auth_receipt',receipt);localStorage.setItem('miyan_auth_expiry',String(data.expires_at||'永久'));if(cardKey)localStorage.setItem('miyan_card_key',cardKey);say('验证成功，正在进入预测实验室。','ok');gate.hidden=true;document.body.style.overflow='';startApp()}
  function recheck(){var receipt=localStorage.getItem('miyan_auth_receipt');if(!receipt)return Promise.resolve(false);return request('recheck','recheck',{auth_receipt:receipt}).then(function(r){if(r.data.rechecked===true){gate.hidden=true;document.body.style.overflow='';say('授权复核成功。','ok');startApp();return true}throw new Error('授权已失效，请重新验证')}).catch(function(e){localStorage.removeItem('miyan_auth_receipt');localStorage.removeItem('miyan_auth_expiry');say(e.message||'请重新输入卡密');return false})}
  function auth(){var card=(input.value||'').trim();if(!card){say('请先输入授权卡密。','err');input.focus();return}if(typeof JSEncrypt==='undefined'||typeof CryptoJS==='undefined'){say('加密组件加载失败，请检查网络后刷新。','err');return}busy(true,'验证中…');say('正在建立加密连接并验证卡密…');request('auth','auth',{card_key:card}).then(function(r){var d=r.data,authorized=d.authorized===true||d.authorized==='true';if(!authorized)throw new Error(d.message||'卡密验证未通过');return request('recheck','recheck',{auth_receipt:d.auth_receipt}).then(function(rr){if(rr.data.rechecked!==true)throw new Error('服务端复核失败');unlock(d,card)})}).catch(function(e){say(e.message||'验证失败，请稍后重试。','err')}).finally(function(){busy(false)})}
  function unbind(){var card=(input.value||localStorage.getItem('miyan_card_key')||'').trim();if(!card){say('请先输入需要解绑的卡密。','err');input.focus();return}busy(true,'解绑中…');say('正在请求服务端解绑…');request('unbind','unbind',{card_key:card}).then(function(r){var d=r.data;if(d.status===true||d.status==='true'){localStorage.removeItem('miyan_auth_receipt');localStorage.removeItem('miyan_auth_expiry');localStorage.removeItem('miyan_card_key');say((d.message||'设备解绑成功')+(d.unbind_count!==undefined?'\n已解绑次数：'+d.unbind_count:''),'ok')}else throw new Error(d.message||'解绑失败')}).catch(function(e){say(e.message||'解绑失败，请稍后重试。','err')}).finally(function(){busy(false)})}
  verifyBtn.addEventListener('click',auth);unbindBtn.addEventListener('click',unbind);input.addEventListener('keydown',function(e){if(e.key==='Enter')auth()});noticeClose.addEventListener('click',hideNotice);updateBtn.addEventListener('click',openUpdateUrl);if(announcementBtn)announcementBtn.addEventListener('click',function(){checkUpdate(true)});if(gateAnnouncementBtn)gateAnnouncementBtn.addEventListener('click',function(){setGateAnnouncement('正在检查公告','正在向服务端请求最新公告与版本信息…','loading');checkUpdate(true)});noticeOverlay.addEventListener('click',function(e){if(e.target===noticeOverlay&&!updateState.force)hideNotice()});document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!noticeOverlay.hidden&&!updateState.force)hideNotice()});document.body.style.overflow='hidden';
  if(typeof JSEncrypt==='undefined'||typeof CryptoJS==='undefined'){say('加密组件加载失败。已尝试多个 CDN 源，请检查网络连接后刷新。','err')}else{say('正在复核本设备的授权状态…');checkUpdate(false);recheck().then(function(ok){if(!ok){var saved=localStorage.getItem('miyan_card_key');if(saved)input.value=saved;gate.hidden=false;document.body.style.overflow='hidden';say('请输入卡密完成验证。')}})}
})();

// Casual copy/long-press protection. Inputs and text fields remain editable.
(function(){
 const editable=e=>!!e.closest('input,textarea,[contenteditable="true"],.allow-select');
 document.addEventListener('contextmenu',e=>{if(!editable(e.target))e.preventDefault()},{capture:true});
 ['copy','cut','dragstart'].forEach(type=>document.addEventListener(type,e=>{if(!editable(e.target))e.preventDefault()},{capture:true}));
 document.addEventListener('selectstart',e=>{if(!editable(e.target))e.preventDefault()},{capture:true});
})();
