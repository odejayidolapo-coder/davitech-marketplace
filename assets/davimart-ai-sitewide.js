(function(){
"use strict";
if(window.__davimartAiSitewideLoaded)return;
window.__davimartAiSitewideLoaded=true;
function mount(){
 if(document.getElementById("dmAiSitewideFrame"))return;
 var frame=document.createElement("iframe");
 frame.id="dmAiSitewideFrame";
 frame.title="DAVIMART AI assistant";
 frame.src=new URL("index.html?davimartAiWidget=1",location.href).href;
 frame.setAttribute("allow","microphone; autoplay");
 frame.setAttribute("aria-label","DAVIMART AI assistant");
 frame.style.cssText="position:fixed;right:10px;bottom:82px;width:205px;height:58px;border:0;background:transparent;z-index:2147483000;overflow:hidden;transition:width .18s ease,height .18s ease,bottom .18s ease;pointer-events:auto";
 document.body.appendChild(frame);
 function resize(open){
  if(open){frame.style.width="min(420px,calc(100vw - 16px))";frame.style.height="min(760px,calc(100dvh - 100px))";frame.style.bottom="88px";}
  else{frame.style.width="205px";frame.style.height="58px";frame.style.bottom="82px";}
 }
 window.addEventListener("message",function(event){
  if(event.origin!==location.origin||event.source!==frame.contentWindow||!event.data)return;
  if(event.data.type==="davimart-ai-open")resize(true);
  if(event.data.type==="davimart-ai-close")resize(false);
  if(event.data.type==="davimart-ai-resize"&&frame.style.height!=="58px")resize(true);
 });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();