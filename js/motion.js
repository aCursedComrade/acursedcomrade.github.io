NexT.motion={},NexT.motion.integrator={queue:[],init:function(){return this.queue=[],this},add:function(e){const t=e();return CONFIG.motion.async?this.queue.push(t):this.queue=this.queue.concat(t),this},bootstrap:function(){CONFIG.motion.async||(this.queue=[this.queue]),this.queue.forEach((e=>{const t=window.anime.timeline({duration:200,easing:"linear"});e.forEach((e=>{e.deltaT?t.add(e,e.deltaT):t.add(e)}))}))}},NexT.motion.middleWares={header:function(){const e=[];function t(t,o=!1){e.push({targets:t,opacity:1,top:0,deltaT:o?"-=200":"-=0"})}var o;t(".column"),"Mist"===CONFIG.scheme&&(o=".logo-line",e.push({targets:o,scaleX:[0,1],duration:500,deltaT:"-=200"})),"Muse"===CONFIG.scheme&&t(".custom-logo-image"),t(".site-title"),t(".site-brand-container .toggle",!0),t(".site-subtitle"),("Pisces"===CONFIG.scheme||"Gemini"===CONFIG.scheme)&&t(".custom-logo-image");const n=CONFIG.motion.transition.menu_item;return n&&document.querySelectorAll(".menu-item").forEach((t=>{e.push({targets:t,complete:()=>t.classList.add("animated",n),deltaT:"-=200"})})),e},subMenu:function(){const e=document.querySelectorAll(".sub-menu .menu-item");return e.length>0&&e.forEach((e=>{e.classList.add("animated")})),[]},postList:function(){const e=[],{post_block:t,post_header:o,post_body:n,coll_header:i}=CONFIG.motion.transition;function s(t,o){t&&o.forEach((o=>{e.push({targets:o,complete:()=>o.classList.add("animated",t),deltaT:"-=100"})}))}return document.querySelectorAll(".post-block").forEach((a=>{e.push({targets:a,complete:()=>a.classList.add("animated",t),deltaT:"-=100"}),s(i,a.querySelectorAll(".collection-header")),s(o,a.querySelectorAll(".post-header")),s(n,a.querySelectorAll(".post-body"))})),s(t,document.querySelectorAll(".pagination, .comments")),e},sidebar:function(){const e=[],t=document.querySelectorAll(".sidebar-inner"),o=CONFIG.motion.transition.sidebar;return o&&("Pisces"===CONFIG.scheme||"Gemini"===CONFIG.scheme)&&window.innerWidth>=992&&t.forEach((t=>{e.push({targets:t,complete:()=>t.classList.add("animated",o),deltaT:"-=100"})})),e},footer:function(){return[{targets:document.querySelector(".footer"),opacity:1}]}};