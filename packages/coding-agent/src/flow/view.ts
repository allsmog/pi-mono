export interface FlowPageOptions {
	hosted?: boolean;
	examples?: Array<{ id: string; label: string; url: string }>;
}

/** Render the project graph screen without external assets or script dependencies. */
export function renderFlowPage(nonce: string, options: FlowPageOptions = {}): string {
	const escapedNonce = nonce.replace(/[&<>"']/g, (character) => {
		switch (character) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			default:
				return "&#39;";
		}
	});
	const serializedOptions = JSON.stringify(options)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");
	return String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Pi Flow · Project data flow</title>
<style nonce="${escapedNonce}">
:root{--bg:#0c1016;--panel:#10151d;--surface:#151c26;--line:#242d39;--muted:#8996a8;--text:#e5ecf5;--cyan:#6ce2cd;--violet:#a99afa;--amber:#e6bd76;--blue:#8abcf8;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;color:var(--text);background:var(--bg)}
*{box-sizing:border-box}body{margin:0;overflow:hidden}button,input,select{font:inherit}button,select{cursor:pointer}button{color:inherit;border:1px solid transparent;background:none}button:disabled{opacity:.45;cursor:wait}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible,a:focus-visible{outline:2px solid var(--cyan);outline-offset:3px}button:hover{background:#202936}a{color:var(--cyan)}svg{display:block}button svg{width:16px;height:16px;flex-shrink:0}button,summary{user-select:none}button,summary,input,select{border-radius:7px}h1,h2,h3,p{margin:0}.mono{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace}.subtle{color:var(--muted)}.eyebrow{font-size:10px;font-weight:650;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted)}.dot{width:6px;height:6px;border-radius:50%;background:var(--cyan);display:inline-block;flex-shrink:0}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
.topbar{height:65px;display:flex;align-items:center;border-bottom:1px solid var(--line);padding:0 22px;gap:20px;background:#11161e}.brand{display:flex;align-items:center;gap:12px;min-width:153px}.pi{font-family:Georgia,serif;font-size:34px;color:var(--cyan);font-weight:bold;line-height:1}.brand-divider{color:#3a4554;font-size:21px;font-weight:300}.brand-name{font-size:12px;font-weight:650;letter-spacing:2.5px}.breadcrumb{display:flex;align-items:center;gap:11px;min-width:0}.project-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px}.branch{display:flex;align-items:center;gap:6px;font-size:10px;color:#a1aec0;padding:5px 8px;background:#19202b;border:1px solid #2a3444;border-radius:5px;max-width:230px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.branch svg{width:12px;height:12px;flex-shrink:0}.top-actions{margin-left:auto;display:flex;gap:8px;align-items:center}.local-pill{display:flex;gap:7px;align-items:center;color:#9badbd;font-size:11px;margin-right:11px}.button{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:8px 11px;border-color:#303a49;background:#19212d;font-size:11px;font-weight:550;white-space:nowrap}.button.primary{border-color:#345a52;background:#182f2b;color:#a6ebd9}.export-wrap{position:relative}.export-wrap summary{list-style:none}.export-wrap summary::-webkit-details-marker{display:none}.export-menu{position:absolute;right:0;top:38px;z-index:20;width:170px;padding:5px;border:1px solid #354154;background:#1b2431;box-shadow:0 12px 40px #0008;border-radius:8px}.export-menu button{width:100%;text-align:left;padding:9px;font-size:12px}.example-switcher{display:flex;gap:8px;align-items:center}.example-switcher[hidden]{display:none}.example-switcher select{background:#19232f;border:1px solid #354253;padding:7px 9px;font-size:11px;color:#d3e1f1;max-width:160px}.hosted .branch{max-width:160px}.run-locally{margin-top:15px;padding:11px;background:#17201e;border:1px solid #2f453c;border-radius:7px;font-size:10px;line-height:1.8;color:#9aaca4}.run-locally code{color:#b8e7d1;font-size:12px;display:block;margin:6px 0}.run-locally a{color:#a7d1c2;text-underline-offset:3px}
.workspace{height:calc(100vh - 65px);display:grid;grid-template-columns:195px minmax(0,1fr) 292px}.sidebar{display:flex;flex-direction:column;background:#10151c;border-right:1px solid var(--line);min-height:0;padding:22px 12px 15px}.sidebar-title{padding:0 12px 13px}.nav-item{width:100%;display:flex;align-items:center;gap:9px;padding:10px 12px;text-align:left;font-size:12px;color:#a7b4c5;margin-bottom:3px}.nav-item.active{background:#1c2c2c;color:#a5ecdb;border:1px solid #2d4541}.nav-item .count{margin-left:auto;background:#252e3c;font-size:10px;padding:2px 5px;border-radius:4px;color:#a4b3c6}.sidebar-rule{border-top:1px solid var(--line);margin:17px 6px 21px}.sidebar-section{display:flex;align-items:center;justify-content:space-between;padding:0 12px 10px}.node-list{overflow-y:auto;min-height:0;flex:1;padding-right:2px;scrollbar-width:thin;scrollbar-color:#334153 transparent}.node-link{width:100%;text-align:left;display:flex;gap:8px;padding:9px 11px;align-items:center;color:#a5b1c3;font-size:11px;line-height:1.35}.node-link .node-dot{width:6px;height:6px;flex-shrink:0;border-radius:2px;background:var(--violet)}.node-link[data-kind=entry] .node-dot{background:var(--cyan)}.node-link[data-kind=store] .node-dot{background:var(--amber)}.node-link[data-kind=external] .node-dot{background:var(--blue)}.node-link[aria-pressed=true]{background:#24263d;color:#ddd8fc}.node-link .node-label{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1}.node-link .node-count{color:#66768c;font-family:monospace;font-size:10px}.list-separator{padding:16px 11px 7px;color:#69798e;letter-spacing:1.2px;text-transform:uppercase;font-size:9px}.sidebar-footer{border-top:1px solid var(--line);padding:16px 11px 0;font-size:10px;color:#72849b;line-height:1.8}.sidebar-footer strong{font-weight:500;color:#a1afc0}.sidebar-footer .local-line{display:flex;gap:7px;align-items:center;margin-bottom:5px}.sidebar-footer .dot{width:5px;height:5px}
.main{min-width:0;min-height:0;display:flex;flex-direction:column;background:linear-gradient(155deg,#111822 0,#0c1119 47%)}.page-header{padding:28px 28px 22px;display:flex;align-items:flex-start;gap:20px}.page-heading{flex:1;min-width:0}.page-kicker{color:#7b92a8;letter-spacing:1.6px;text-transform:uppercase;font-size:9px;margin-bottom:9px}.page-header h1{font-weight:550;letter-spacing:-.7px;font-size:27px;line-height:1.3}.page-description{font-size:11px;line-height:1.7;color:#8d9db1;margin-top:7px}.scan-badge{display:flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid #29433e;border-radius:5px;font-size:10px;color:#a0cfbf;white-space:nowrap;margin-top:5px;background:#14231f}.metrics{display:flex;align-items:center;gap:23px;margin:0 28px 22px}.metric{display:flex;align-items:baseline;gap:6px}.metric strong{font-size:19px;font-weight:500;letter-spacing:-.4px;color:#d9e2ee}.metric span{font-size:10px;color:#8293a9}.metric-divider{height:22px;border-left:1px solid var(--line)}
.canvas-card{margin:0 20px 19px;display:flex;flex-direction:column;flex:1;min-height:0;border:1px solid #293342;border-radius:11px;background:#0c121b;overflow:hidden;box-shadow:0 8px 40px #0002}.canvas-toolbar{height:52px;flex-shrink:0;display:flex;align-items:center;gap:10px;padding:0 15px;border-bottom:1px solid #232e3c;background:#131b26}.view-label{display:flex;align-items:center;gap:7px;font-size:11px;color:#d1dbeb;white-space:nowrap}.view-label svg{height:15px;width:15px;color:var(--cyan)}.toolbar-divider{height:18px;border-left:1px solid #303a49;margin:0 2px}.search-box{display:flex;align-items:center;gap:6px;min-width:85px;flex:1;max-width:220px;color:#72849a}.search-box svg{width:13px;height:13px;flex-shrink:0}.search-box input{border:0;background:transparent;color:var(--text);width:100%;min-width:20px;padding:6px 0;font-size:11px;outline-offset:1px}.search-box input::placeholder{color:#78879b}.toolbar-right{margin-left:auto;display:flex;align-items:center;gap:9px}.dependency-toggle{display:flex;gap:6px;align-items:center;color:#91a1b5;font-size:10px;white-space:nowrap;cursor:pointer}.dependency-toggle input{accent-color:var(--violet);height:12px;width:12px;cursor:pointer}.scope-select{background:#18222f;border:1px solid #2c394c;padding:5px 7px;color:#a9bad0;font-size:10px;max-width:129px}.canvas{position:relative;flex:1;min-height:260px;overflow:hidden;background-color:#0d141e;background-image:radial-gradient(#2a3545 1px,transparent 1px);background-size:19px 19px}.graph{height:100%;width:100%;touch-action:none;cursor:grab}.graph.dragging{cursor:grabbing}.canvas-state{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:#0d141eed;z-index:5;padding:25px;text-align:center}.canvas-state[hidden]{display:none}.state-symbol{height:45px;width:45px;display:flex;align-items:center;justify-content:center;background:#1a2e2c;border:1px solid #2d4c47;border-radius:12px;color:var(--cyan)}.state-symbol svg{width:22px;height:22px}.canvas-state h2{font-size:17px;font-weight:500}.canvas-state p{color:#8c9eb5;font-size:12px;line-height:1.8;max-width:400px}.graph-controls{position:absolute;bottom:15px;left:15px;display:flex;align-items:center;gap:1px;padding:3px;background:#17212e;border:1px solid #334052;border-radius:7px;box-shadow:0 4px 15px #0004}.graph-controls button{height:29px;min-width:29px;display:flex;align-items:center;justify-content:center;font-size:17px;color:#aebed2}.graph-controls button:hover{background:#293648}.graph-controls .zoom-value{font-size:10px;color:#91a3bd;min-width:38px;text-align:center;padding:0 4px}.control-divider{height:16px;border-left:1px solid #334052;margin:0 3px}.canvas-hint{position:absolute;right:15px;bottom:24px;font-size:9px;color:#63758d;pointer-events:none}.canvas-footer{flex-shrink:0;min-height:42px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;border-top:1px solid #222c39;background:#111923}.legend{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.legend-item{display:flex;align-items:center;gap:5px;font-size:9px;color:#8b9bb0;white-space:nowrap}.legend-mark{height:6px;width:6px;border-radius:2px;background:var(--cyan)}.legend-mark.process{background:var(--violet)}.legend-mark.store{background:var(--amber)}.legend-mark.external{background:var(--blue)}.legend-line{width:14px;border-top:1px dashed #78889d}.visible-count{font-size:9px;color:#6c819a;white-space:nowrap}.main-footnote{font-size:10px;color:#73869f;padding:0 27px 17px;line-height:1.6;display:flex;gap:8px;align-items:flex-start}.main-footnote svg{height:13px;width:13px;flex-shrink:0;margin-top:1px}
.inspector{background:#11171f;border-left:1px solid var(--line);display:flex;flex-direction:column;min-height:0}.inspector-header{height:56px;display:flex;align-items:center;padding:0 20px;border-bottom:1px solid var(--line);gap:8px;font-size:11px;font-weight:500;color:#bbc8d9}.inspector-header svg{width:14px;height:14px;color:#7c8da5}.inspector-header .shortcut{margin-left:auto;font-family:monospace;color:#7f90a6;border:1px solid #303b4c;border-radius:4px;font-size:9px;padding:2px 5px}.inspector-content{padding:22px 20px;overflow:auto;min-height:0;flex:1;scrollbar-width:thin;scrollbar-color:#354456 transparent}.inspect-kind{display:inline-flex;gap:6px;align-items:center;border:1px solid #3d365b;background:#241f36;color:#c3b6ed;border-radius:5px;padding:4px 7px;font-size:9px;margin-bottom:13px;text-transform:uppercase;letter-spacing:.7px}.inspect-kind[data-kind=entry]{border-color:#31514c;color:#9bdcc9;background:#1a302b}.inspect-kind[data-kind=store]{border-color:#554837;color:#ddc18e;background:#30291e}.inspect-kind[data-kind=external]{border-color:#314766;color:#a2c7f5;background:#1c2c41}.inspector h2{font-size:19px;font-weight:550;letter-spacing:-.25px;line-height:1.5;overflow-wrap:anywhere}.inspect-description{font-size:11px;color:#8a9bb1;line-height:1.85;margin-top:9px}.inspect-section{margin-top:24px;padding-top:20px;border-top:1px solid #263140}.inspect-section h3{font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:#7e93ae;font-weight:600;margin-bottom:12px}.inspect-pair{display:flex;gap:12px;justify-content:space-between;font-size:10px;line-height:1.6;margin-bottom:9px;color:#7f92ab}.inspect-pair span:last-child{color:#c1cedf;text-align:right;overflow-wrap:anywhere;max-width:155px}.tag-list{display:flex;gap:5px;flex-wrap:wrap}.tag{background:#1a2330;border:1px solid #2d394a;border-radius:5px;padding:4px 6px;color:#9cacbf;font-size:9px}.path-text{font-size:10px;font-family:monospace;line-height:1.7;color:#a3b6cf;overflow-wrap:anywhere}.file-card{border:1px solid #2c394c;background:#17202d;border-radius:7px;padding:10px;margin-bottom:7px;overflow:hidden}.file-card .path-text{font-size:9px}.evidence-location{display:flex;align-items:flex-start;gap:6px;color:#9fc5e8;font-family:monospace;font-size:9px;line-height:1.7;overflow-wrap:anywhere}.evidence-location svg{width:11px;height:11px;flex-shrink:0;margin-top:2px}.evidence-code{font-family:monospace;font-size:10px;line-height:1.8;white-space:pre-wrap;word-break:break-word;color:#c0ccdc;margin:8px 0 0;padding-top:8px;border-top:1px solid #2a3648}.connection-item{display:flex;flex-direction:column;gap:7px;width:100%;text-align:left;border:1px solid #2a374a;background:#151f2b;border-radius:7px;padding:10px;margin-bottom:7px}.connection-item:hover{border-color:#4f637d;background:#1b293a}.connection-topline{display:flex;gap:8px;align-items:center;justify-content:space-between;font-size:10px;color:#c4d2e4}.connection-topline svg{width:12px;height:12px;color:#7e9cae;flex-shrink:0}.connection-kind{font-size:9px;color:#8095af;display:flex;justify-content:space-between;gap:8px}.confidence{font-size:9px;color:#92b8a7}.confidence.inferred{color:#c3ab7a}.inspect-empty{font-size:11px;color:#7e91aa;line-height:1.8}.inspect-note{padding:10px 12px;border:1px solid #374239;border-radius:7px;background:#1b251e;color:#94b09c;font-size:10px;line-height:1.8;margin-top:19px}.warning{color:#c5aa7a;border-color:#4c4030;background:#282219}.inspector-footer{font-family:monospace;border-top:1px solid var(--line);padding:12px 20px;font-size:9px;color:#62758f;line-height:1.7}.inspector-footer .footer-heading{color:#8b9cb2;font-family:inherit}
.graph .boundary{fill:#141d2a44;stroke:#334359;stroke-width:1;stroke-dasharray:5 5}.graph .boundary.network{fill:#17233744;stroke:#354b65}.graph .boundary.host{fill:#211f2044;stroke:#494538}.graph .boundary-label{font-size:10px;font-family:Inter,-apple-system,sans-serif;letter-spacing:1.5px;fill:#7188a4;font-weight:600}.graph .boundary.network+.boundary-label{fill:#7195bc}.graph .boundary.host+.boundary-label{fill:#a39374}.graph .graph-edge{fill:none;stroke:#5b738f;stroke-width:1.5;opacity:.62;transition:opacity .12s,stroke .12s}.graph .graph-edge.dependency{stroke:#7e749b;stroke-dasharray:5 5;opacity:.35}.graph .graph-edge.read,.graph .graph-edge.write{stroke:#a28c65}.graph .graph-edge.network{stroke:#7095c3}.graph .graph-edge.input,.graph .graph-edge.output{stroke:#5ea998}.graph .graph-edge.selected{stroke:var(--cyan);stroke-width:2.3;opacity:1}.graph .graph-edge.faded{opacity:.1}.graph .edge-hit{fill:none;stroke:transparent;stroke-width:14;cursor:pointer}.graph .edge-hit:focus{outline:none;stroke:#99cfcf44;stroke-width:12}.graph .edge-label-bg{fill:#0d141ef2;stroke:#29384b;stroke-width:.6}.graph .edge-label{font:9px "SFMono-Regular",Consolas,monospace;fill:#8b9eb6;pointer-events:none}.graph .edge-label-group.selected .edge-label{fill:#a2e3d5}.graph .edge-label-group.faded{opacity:.15}.graph .graph-node{cursor:pointer;transition:opacity .12s}.graph .graph-node:focus{outline:none}.graph .node-box{fill:#1b2232;stroke:#46415e;stroke-width:1;filter:url(#card-shadow)}.graph .graph-node[data-kind=entry] .node-box{fill:#152a2b;stroke:#345951}.graph .graph-node[data-kind=store] .node-box{fill:#2a261e;stroke:#5c4f37}.graph .graph-node[data-kind=external] .node-box{fill:#1b293d;stroke:#354f70}.graph .graph-node.selected .node-box,.graph .graph-node:focus .node-box{stroke:#a1e7d5;stroke-width:2}.graph .graph-node.faded{opacity:.25}.graph .node-kind{fill:#9b8ec4;font-size:8px;letter-spacing:1.2px;font-weight:600;font-family:Inter,-apple-system,sans-serif}.graph .graph-node[data-kind=entry] .node-kind{fill:#7bbdaf}.graph .graph-node[data-kind=store] .node-kind{fill:#b7a073}.graph .graph-node[data-kind=external] .node-kind{fill:#87a9d1}.graph .node-title{fill:#e0e7f1;font-size:13px;font-family:Inter,-apple-system,sans-serif;font-weight:550;letter-spacing:-.15px}.graph .node-subtitle{fill:#8293ab;font-size:8px;font-family:Consolas,monospace}.graph .node-icon-box{fill:#a391d514}.graph .node-icon{stroke:#b5a6e0;fill:none;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}.graph .graph-node[data-kind=entry] .node-icon{stroke:#85c9b9}.graph .graph-node[data-kind=store] .node-icon{stroke:#d0b37a}.graph .graph-node[data-kind=external] .node-icon{stroke:#97b9e8}.graph .port{fill:#101a27;stroke:#5f7290;stroke-width:1}.graph .selected .port{fill:#a1e7d5;stroke:#a1e7d5}.graph .node-files{fill:#71849f;font-size:8px;font-family:monospace}.graph .node-accent{fill:#a391d5}.graph .graph-node[data-kind=entry] .node-accent{fill:#6dcbb5}.graph .graph-node[data-kind=store] .node-accent{fill:#c9ad76}.graph .graph-node[data-kind=external] .node-accent{fill:#82a9db}
.source-dialog{background:#121b27;color:#d8e2f1;border:1px solid #3a4a61;border-radius:12px;padding:0;width:min(800px,90vw);max-height:80vh;box-shadow:0 20px 80px #0009}.source-dialog::backdrop{background:#05080dbb;backdrop-filter:blur(3px)}.dialog-heading{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--line)}.dialog-heading h2{font-size:17px;font-weight:550}.dialog-heading button{padding:7px 10px}.source-dialog .dialog-note{padding:15px 24px;color:#8b9db5;font-size:11px}.source-table{border-collapse:collapse;width:100%;font-size:11px}.source-table th{text-align:left;color:#7289a6;font-size:9px;text-transform:uppercase;letter-spacing:1px;padding:12px 24px;border-bottom:1px solid #273345}.source-table td{padding:11px 24px;border-bottom:1px solid #202c3c;overflow-wrap:anywhere}.source-table .file-button{padding:0;text-align:left;font-family:monospace;color:#acc7e6;font-size:11px}.source-table tr:hover{background:#1b2839}.source-table th:nth-child(2),.source-table td:nth-child(2){width:100px}.source-table th:nth-child(3),.source-table td:nth-child(3){width:70px;text-align:right}.file-scroll{overflow:auto;max-height:58vh}.toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#20372f;color:#bfebd8;border:1px solid #3e6859;padding:11px 17px;border-radius:7px;box-shadow:0 8px 30px #0007;font-size:12px;z-index:40}.toast[hidden]{display:none}
@media(min-width:1700px){.workspace{grid-template-columns:220px minmax(0,1fr) 330px}.topbar{padding:0 27px}.brand{min-width:170px}.inspector-content{padding:25px}.page-header{padding-top:33px}.page-header h1{font-size:31px}.canvas-card{margin-left:26px;margin-right:26px}.page-description{font-size:12px}.canvas-toolbar{gap:14px}.dependency-toggle,.scope-select{font-size:11px}}
@media(max-width:1190px){.workspace{grid-template-columns:168px minmax(0,1fr) 260px}.sidebar{padding-left:8px;padding-right:8px}.topbar{padding:0 17px;gap:10px}.brand{min-width:140px}.local-pill{display:none}.page-header{padding:24px 20px 20px}.page-header h1{font-size:24px}.metrics{margin-left:20px;gap:16px}.canvas-card{margin-left:13px;margin-right:13px}.canvas-toolbar{gap:7px;padding:0 11px}.view-label span{display:none}.toolbar-divider{display:none}.search-box{max-width:160px}.inspector-content{padding:20px 16px}.scan-badge{display:none}.legend{gap:9px}.legend-item{font-size:8px}.canvas-hint{display:none}.branch{max-width:180px}.metric strong{font-size:17px}}
@media(max-width:950px){.workspace{grid-template-columns:150px minmax(0,1fr)}.inspector{display:none}.workspace.has-selection .inspector{display:flex;position:absolute;right:0;top:65px;bottom:0;width:280px;z-index:12;box-shadow:-15px 0 40px #0005}.inspector-header .shortcut{cursor:pointer}.brand{min-width:120px}.branch{display:none}.page-header{padding-top:23px}.scan-badge{display:flex}.canvas-toolbar{gap:10px}.view-label span{display:inline}.metrics{gap:20px}.main-footnote{font-size:9px}}
@media(max-width:640px){body{overflow:auto}.topbar{height:58px;padding:0 13px}.brand{min-width:auto;gap:7px}.pi{font-size:28px}.brand-name{font-size:10px;letter-spacing:1.5px}.brand-divider{font-size:17px}.breadcrumb{margin-left:6px}.project-name{font-size:11px;max-width:130px}.top-actions{gap:5px}.top-actions .button{padding:7px;font-size:10px}.top-actions .button svg{width:13px;height:13px}.top-actions .button-label{display:none}.workspace{height:calc(100dvh - 58px);grid-template-columns:minmax(0,1fr)}.sidebar{display:none}.workspace.has-selection .inspector{top:58px;width:min(310px,88vw)}.page-header{padding:22px 18px 17px}.page-header h1{font-size:23px}.page-description{font-size:10px}.page-kicker{font-size:8px}.scan-badge{display:none}.metrics{margin:0 18px 17px;gap:13px;justify-content:space-between}.metric{gap:4px}.metric strong{font-size:16px}.metric span{font-size:9px}.metric-divider{display:none}.canvas-card{margin:0 10px 12px}.canvas-toolbar{height:auto;min-height:48px;gap:8px;padding:9px 10px;flex-wrap:wrap}.view-label{font-size:10px}.view-label span{display:none}.search-box{max-width:none;flex:1}.toolbar-right{gap:7px}.dependency-toggle{font-size:9px}.scope-select{font-size:9px;padding:5px;max-width:110px}.canvas-footer{padding:9px 10px;align-items:flex-start;gap:8px;flex-direction:column}.legend{gap:12px}.legend-item{font-size:8px}.main-footnote{padding:0 17px 12px}.canvas{min-height:270px}.source-table td,.source-table th{padding:10px 14px}.source-table th:nth-child(2),.source-table td:nth-child(2){display:none}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
.button{font-size:12px}.nav-item{font-size:13px}.node-link{font-size:12px}.node-link .node-count{font-size:11px}.sidebar-footer{font-size:11px}.page-description{font-size:13px}.page-kicker{font-size:10px}.metric span{font-size:12px}.scan-badge{font-size:11px}.view-label{font-size:12px}.search-box input{font-size:12px}.dependency-toggle,.scope-select{font-size:11px}.legend-item,.visible-count{font-size:10px}.main-footnote{font-size:11px}.inspector-header{font-size:12px}.inspector h2{font-size:21px}.inspect-description,.inspect-empty{font-size:12px}.inspect-section h3{font-size:10px}.inspect-pair{font-size:12px}.tag{font-size:10px}.path-text{font-size:11px}.file-card .path-text,.evidence-location{font-size:10px}.evidence-code{font-size:11px}.connection-topline{font-size:12px}.connection-kind,.confidence{font-size:10px}.inspect-note{font-size:11px}.inspector-footer{font-size:10px}.graph .node-title{font-size:15px}.graph .node-kind{font-size:9px}.graph .node-subtitle{font-size:10px}.graph .node-files{font-size:9px}.graph .edge-label{font-size:11px}.graph .boundary-label{font-size:11px}.graph .graph-edge{opacity:.75}.graph .graph-edge.dependency{opacity:.35}.graph .graph-edge.selected{opacity:1}.graph .graph-edge.faded{opacity:.1}.example-switcher select{font-size:12px}.run-locally{font-size:11px}
@media(max-width:1190px){.hosted .local-pill{display:none}.hosted .branch{display:none}.example-switcher select{max-width:150px}}
@media(max-width:640px){.hosted .breadcrumb{display:none}.example-switcher select{max-width:145px;font-size:10px;padding:6px}.hosted .topbar{gap:8px}.hosted .brand{gap:5px}.example-switcher .eyebrow{display:none}.page-description{font-size:11px}.metric span{font-size:10px}.dependency-toggle,.scope-select{font-size:10px}.legend-item,.visible-count{font-size:9px}.main-footnote{font-size:10px}.search-box input{font-size:11px}}
</style>
</head>
<body>
<header class="topbar">
 <div class="brand" aria-label="Pi Flow"><span class="pi" aria-hidden="true">π</span><span class="brand-divider">/</span><span class="brand-name">FLOW</span></div>
 <label class="example-switcher" id="example-switcher" hidden><span class="eyebrow">Example</span><select id="example-select" aria-label="Example codebase"></select></label>
 <div class="breadcrumb"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7b8ca5" stroke-width="1.5" aria-hidden="true"><path d="M3 7h7l2 2h9v10H3Z"/><path d="M3 7V5h7l2 2"/></svg><span class="project-name" id="project-name">Opening project</span><span class="branch mono"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="5" cy="4" r="2"/><circle cx="5" cy="16" r="2"/><circle cx="15" cy="5" r="2"/><path d="M5 6v8m0-2c6 0 10-2 10-5"/></svg><span id="branch-name">—</span></span></div>
 <div class="top-actions"><span class="local-pill"><span class="dot"></span><span id="session-label">Local session</span></span><button class="button" id="rescan" type="button" aria-label="Rescan project"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.7-1l2.2 6M4 12l2.2 6A7 7 0 0 0 18 17"/></svg><span class="button-label" id="rescan-label">Rescan project</span></button><details class="export-wrap" id="export-menu"><summary class="button primary" aria-label="Export graph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/></svg><span class="button-label">Export</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary><div class="export-menu"><button type="button" id="export-json">Graph as JSON</button><button type="button" id="export-mermaid">Diagram as Mermaid</button></div></details></div>
</header>
<div class="workspace" id="workspace">
 <aside class="sidebar" aria-label="Project navigation">
  <div class="sidebar-title eyebrow">Workspace</div>
  <button class="nav-item active" id="overview" type="button"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="2" y="2" width="6" height="6" rx="1"/><rect x="12" y="2" width="6" height="6" rx="1"/><rect x="2" y="12" width="6" height="6" rx="1"/><rect x="12" y="12" width="6" height="6" rx="1"/></svg>Overview</button>
  <button class="nav-item" id="source-index" type="button"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M5 2h7l4 4v12H5Z"/><path d="M12 2v5h4M8 10h5m-5 3h5"/></svg>Source index<span class="count" id="source-count">—</span></button>
  <div class="sidebar-rule"></div><div class="sidebar-section"><span class="eyebrow">Components</span><span class="mono subtle" id="component-count">—</span></div>
  <div class="node-list" id="node-list" aria-label="Components and resources"></div>
  <div class="sidebar-footer"><div class="local-line"><span class="dot"></span><strong id="sidebar-mode">Runs on your machine</strong></div><span id="sidebar-mode-detail">Source-derived graph</span><br><span id="sidebar-version">Pi project analysis</span></div>
 </aside>
 <main class="main">
  <div class="page-header"><div class="page-heading"><div class="page-kicker" id="page-kicker">Explore your codebase</div><h1>Project data flow</h1><p class="page-description" id="page-description">Follow inputs, transformations, and outputs across your project.</p></div><span class="scan-badge"><span class="dot"></span><span id="scan-mode">Static source analysis</span></span></div>
  <div class="metrics" aria-label="Scan statistics"><div class="metric"><strong id="metric-components">—</strong><span>components</span></div><div class="metric-divider"></div><div class="metric"><strong id="metric-flows">—</strong><span>data flows</span></div><div class="metric-divider"></div><div class="metric"><strong id="metric-files">—</strong><span>source files</span></div><div class="metric-divider"></div><div class="metric"><strong id="metric-boundaries">—</strong><span>boundaries</span></div></div>
  <section class="canvas-card" aria-label="Interactive data flow diagram">
   <div class="canvas-toolbar"><div class="view-label"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="1" y="7" width="5" height="6" rx="1"/><rect x="14" y="1" width="5" height="6" rx="1"/><rect x="14" y="13" width="5" height="6" rx="1"/><path d="M6 10h5V4h3m-3 6v6h3"/></svg><span>Data flow</span></div><span class="toolbar-divider"></span><label class="search-box"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="5"/><path d="m12 12 5 5"/></svg><input id="search" type="search" aria-label="Search components and files" placeholder="Find component or file…" autocomplete="off" spellcheck="false"></label><div class="toolbar-right"><label class="dependency-toggle"><input id="dependencies" type="checkbox">Dependencies</label><select id="scope" class="scope-select" aria-label="Diagram scope"><option value="overview">Overview</option><option value="all">All components</option></select></div></div>
   <div class="canvas" id="canvas"><svg id="graph" class="graph" aria-label="Project data flow graph" role="group" tabindex="0"></svg><div class="canvas-state" id="canvas-state" role="status"><span class="state-symbol"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="2" y="9" width="6" height="6" rx="1"/><rect x="16" y="2" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M8 12h5V5h3m-3 7v7h3"/></svg></span><h2 id="state-title">Mapping your project</h2><p id="state-description">Reading source relationships and collecting evidence.</p><button class="button" id="retry" type="button" hidden>Try again</button></div><div class="graph-controls" aria-label="Diagram controls"><button type="button" id="zoom-out" aria-label="Zoom out">−</button><span class="zoom-value mono" id="zoom-value">100%</span><button type="button" id="zoom-in" aria-label="Zoom in">+</button><span class="control-divider"></span><button type="button" id="fit" aria-label="Fit graph to screen" title="Fit graph (F)"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 7V2h5m6 0h5v5M2 13v5h5m6 0h5v-5"/></svg></button></div><span class="canvas-hint mono">scroll to zoom · drag to pan</span></div>
   <div class="canvas-footer"><div class="legend" aria-label="Diagram legend"><span class="legend-item"><span class="legend-mark"></span>Entry point</span><span class="legend-item"><span class="legend-mark process"></span>Process</span><span class="legend-item"><span class="legend-mark store"></span>Data store</span><span class="legend-item"><span class="legend-mark external"></span>External</span><span class="legend-item"><span class="legend-line"></span>Boundary</span></div><span class="visible-count mono" id="visible-count">Waiting for source scan</span></div>
  </section>
  <p class="main-footnote"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M10 9v5m0-8v1"/></svg><span>Relationships are detected or inferred from source. This is not a runtime trace.</span></p>
 </main>
 <aside class="inspector" aria-label="Evidence inspector"><div class="inspector-header"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 2h10l4 4v12H3Z"/><path d="M13 2v5h4M6 10h8m-8 3h5"/></svg>Inspector<button class="shortcut" id="close-inspector" type="button" aria-label="Clear selection">esc</button></div><div class="inspector-content" id="inspector-content"><span class="eyebrow">Source evidence</span><h2>Explore a connection</h2><p class="inspect-description">Select a component or an arrow to see the source locations behind it.</p></div><div class="inspector-footer"><span class="footer-heading">ANALYSIS SNAPSHOT</span><br><span id="scan-timestamp">Waiting for scan</span></div></aside>
</div>
<dialog class="source-dialog" id="source-dialog" aria-labelledby="source-title"><div class="dialog-heading"><h2 id="source-title">Source index</h2><button id="close-sources" type="button" aria-label="Close source index">Close ×</button></div><p class="dialog-note" id="source-note"></p><div class="file-scroll"><table class="source-table"><thead><tr><th>Source file</th><th>Language</th><th>Lines</th></tr></thead><tbody id="source-rows"></tbody></table></div></dialog>
<div class="toast" id="toast" role="status" hidden></div>
<script nonce="${escapedNonce}">
(() => {
 'use strict';
 const pageOptions = ${serializedOptions};
 const $ = (id) => document.getElementById(id);
 const svgNS = 'http://www.w3.org/2000/svg';
 const graphElement = $('graph');
 let graph = null;
 let selectedNode = null;
 let selectedEdge = null;
 let displayedNodes = [];
 let displayedEdges = [];
 let positions = new Map();
 let bounds = { x: 0, y: 0, width: 1100, height: 650 };
 let view = { x: 0, y: 0, width: 1100, height: 650 };
 let fittedWidth = 1100;
 let drag = null;
 let toastTimer = null;
 let loading = false;

 function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
 }
 function svg(tag, attributes, text) {
  const node = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attributes || {})) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
 }
 function shorten(text, length) { return text.length > length ? text.slice(0, length - 1) + '…' : text; }
 function number(value) { return new Intl.NumberFormat().format(value); }
 function titleCase(text) { return text.charAt(0).toUpperCase() + text.slice(1); }
 function activeEdges() { return graph.edges.filter((edge) => $('dependencies').checked || edge.kind !== 'dependency'); }
 function degree(id, edges) { return edges.filter((edge) => edge.source === id || edge.target === id).length; }
 function nodeById(id) { return graph.nodes.find((node) => node.id === id); }
 function announce(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { $('toast').hidden = true; }, 3200);
 }
 function showState(title, description, retry) {
  $('canvas-state').hidden = false;
  $('state-title').textContent = title;
  $('state-description').textContent = description;
  $('retry').hidden = !retry;
 }

 async function load(rescan) {
  if (loading) return;
  loading = true;
  $('rescan').disabled = true;
  $('retry').disabled = true;
  $('example-select').disabled = true;
  if (!graph) showState('Mapping your project', 'Reading source relationships and collecting evidence.', false);
  try {
   const example = pageOptions.hosted && (pageOptions.examples || []).find((item) => item.id === $('example-select').value);
   if (pageOptions.hosted && !example) throw new Error('No example codebase has been configured.');
   const endpoint = pageOptions.hosted ? example.url : rescan ? './api/rescan' : './api/graph';
   const response = await fetch(endpoint, { method: rescan && !pageOptions.hosted ? 'POST' : 'GET', headers: { Accept: 'application/json' } });
   if (!response.ok) throw new Error('The local scanner returned HTTP ' + response.status + '.');
   const data = await response.json();
   // Validate the transport boundary before using server data in the screen.
   if (!data || data.version !== 1 || !data.project || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || !Array.isArray(data.files)) throw new Error('The scanner returned an unsupported graph format.');
   graph = data;
   selectedNode = selectedNode && nodeById(selectedNode) ? selectedNode : null;
   selectedEdge = null;
   updateProject();
   renderSidebar();
   renderDiagram(true);
   renderInspector();
   if (rescan) announce((pageOptions.hosted ? 'Example refreshed · ' : 'Project rescanned · ') + number(graph.project.fileCount) + ' source files');
  } catch (error) {
   if (!graph || pageOptions.hosted) showState('Could not load project', error.message + (pageOptions.hosted ? ' Retry loading the example.' : ' Check that the Pi Flow session is still running.'), true);
   else announce('Rescan failed. The last successful snapshot is still displayed.');
  } finally {
   loading = false;
   $('rescan').disabled = false;
   $('retry').disabled = false;
   $('example-select').disabled = false;
  }
 }

 function updateProject() {
  const project = graph.project;
  document.title = project.name + ' · Pi Flow';
  $('project-name').textContent = project.name;
  $('project-name').title = project.root;
  $('branch-name').textContent = project.gitBranch || 'unversioned';
  $('branch-name').parentElement.title = project.gitBranch || 'Not a Git repository';
  $('metric-components').textContent = number(graph.nodes.filter((node) => node.boundary === 'project').length);
  $('metric-flows').textContent = number(graph.edges.filter((edge) => edge.kind !== 'dependency').length);
  $('metric-files').textContent = number(project.fileCount);
  $('metric-boundaries').textContent = number(new Set(graph.nodes.map((node) => node.boundary)).size);
  $('source-count').textContent = number(project.fileCount);
  $('component-count').textContent = graph.nodes.filter((node) => node.boundary === 'project').length;
  $('sidebar-version').textContent = project.gitCommit ? project.gitCommit.slice(0, 8) + ' · source snapshot' : 'Unversioned source snapshot';
  const date = new Date(project.scannedAt);
  $('scan-timestamp').textContent = Number.isNaN(date.getTime()) ? project.scannedAt : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
 }

 function renderSidebar() {
  const list = $('node-list');
  list.replaceChildren();
  const query = $('search').value.trim().toLowerCase();
  for (const boundary of ['project', 'host', 'network']) {
   const nodes = graph.nodes.filter((node) => node.boundary === boundary && (!query || matchesSearch(node, query)));
   if (!nodes.length) continue;
   if (boundary !== 'project') list.append(element('div', 'list-separator', boundary === 'host' ? 'Host resources' : 'Network services'));
   for (const node of nodes) {
    const button = element('button', 'node-link');
    button.type = 'button';
    button.dataset.kind = node.kind;
    button.dataset.nodeId = node.id;
    button.setAttribute('aria-pressed', String(node.id === selectedNode));
    button.title = node.label + (node.files.length ? ' · ' + node.files.length + ' files' : '');
    button.append(element('span', 'node-dot'), element('span', 'node-label', node.label), element('span', 'node-count', node.files.length ? number(node.files.length) : '↗'));
    button.addEventListener('click', () => selectNode(node.id, true));
    list.append(button);
   }
  }
  if (!list.childElementCount) list.append(element('p', 'inspect-empty', 'No matching components.'));
 }

 function matchesSearch(node, query) {
  return (node.label + ' ' + node.description + ' ' + node.files.join(' ')).toLowerCase().includes(query);
 }

 function chooseNodes(edges) {
  const query = $('search').value.trim().toLowerCase();
  if ($('scope').value === 'all') return graph.nodes;
  const projectNodes = graph.nodes.filter((node) => node.boundary === 'project');
  const ranked = projectNodes.slice().sort((a, b) => degree(b.id, edges) - degree(a.id, edges) || b.files.length - a.files.length || a.label.localeCompare(b.label));
  const ids = new Set(ranked.slice(0, 6).map((node) => node.id));
  if (selectedNode) ids.add(selectedNode);
  if (query) for (const node of graph.nodes) if (matchesSearch(node, query)) ids.add(node.id);
  for (const node of graph.nodes) if (node.boundary !== 'project' && edges.some((edge) => (edge.source === node.id && ids.has(edge.target)) || (edge.target === node.id && ids.has(edge.source)))) ids.add(node.id);
  // Keep non-project selections useful even when their project is outside the overview.
  if (selectedNode && nodeById(selectedNode).boundary !== 'project') {
   for (const edge of edges.filter((edge) => edge.source === selectedNode || edge.target === selectedNode).slice(0, 6)) { ids.add(edge.source); ids.add(edge.target); }
  }
  return graph.nodes.filter((node) => ids.has(node.id));
 }

 function layout(nodes, edges) {
  const width = 200;
  const height = 90;
  positions = new Map();
  const project = nodes.filter((node) => node.boundary === 'project').sort((a, b) => degree(b.id, edges) - degree(a.id, edges) || a.label.localeCompare(b.label));
  const compact = project.length <= 5;
  const gap = compact ? 104 : 120;
  const top = compact ? 60 : 85;
  const groupHeight = (count) => (count - 1) * gap + height + 58;
  const resources = nodes.filter((node) => node.boundary !== 'project');
  const sources = resources.filter((node) => edges.some((edge) => edge.source === node.id) && !edges.some((edge) => edge.target === node.id));
  const sinks = resources.filter((node) => !sources.includes(node));
  const host = sinks.filter((node) => node.boundary === 'host');
  const network = sinks.filter((node) => node.boundary === 'network');
  const columns = compact ? 1 : 2;
  const projectWidth = columns === 1 ? 248 : 490;
  const sourceX = 30;
  const projectX = sources.length ? 300 : 45;
  const sinkX = projectX + projectWidth + 35;
  const projectRows = Math.ceil(project.length / columns);
  const contentHeight = Math.max(projectRows * gap, sources.length * gap, (sinks.length + (host.length && network.length ? .4 : 0)) * gap, 330);
  const groups = [];
  const projectTop = top + Math.max(0, (contentHeight - projectRows * gap) / 2);
  project.forEach((node, index) => {
   const col = columns === 1 ? 0 : index % 2;
   const row = Math.floor(index / columns);
   positions.set(node.id, { x: projectX + col * 242, y: projectTop + row * gap, width, height });
  });
  if (project.length) groups.push({ x: projectX - 23, y: projectTop - 38, width: projectWidth, height: groupHeight(projectRows), boundary: 'project', label: 'PROJECT / ' + shorten(graph.project.name.toUpperCase(), 32) });
  let sourceTop = top + Math.max(0, (contentHeight - sources.length * gap) / 2);
  for (const boundary of ['host', 'network']) {
   const items = sources.filter((node) => node.boundary === boundary);
   if (!items.length) continue;
   items.forEach((node, index) => positions.set(node.id, { x: sourceX, y: sourceTop + index * gap, width, height }));
   groups.push({ x: sourceX - 20, y: sourceTop - 38, width: 240, height: groupHeight(items.length), boundary, label: boundary === 'host' ? 'HOST / INPUTS' : 'NETWORK / INPUTS' });
   sourceTop += items.length * gap + 72;
  }
  let sinkTop = top;
  for (const [boundary, items] of [['host', host], ['network', network]]) {
   if (!items.length) continue;
   items.forEach((node, index) => positions.set(node.id, { x: sinkX, y: sinkTop + index * gap, width, height }));
   groups.push({ x: sinkX - 20, y: sinkTop - 38, width: 240, height: groupHeight(items.length), boundary, label: boundary === 'host' ? 'HOST / LOCAL RESOURCES' : 'NETWORK / EXTERNAL SERVICES' });
   sinkTop += items.length * gap + 72;
  }
  const maxRight = Math.max(700, ...Array.from(positions.values(), (pos) => pos.x + pos.width + 35));
  const maxBottom = Math.max(440, ...groups.map((group) => group.y + group.height + 35));
  bounds = { x: 0, y: 0, width: maxRight, height: maxBottom };
  return groups;
 }

 function createDefinitions() {
  const defs = svg('defs');
  for (const [name, color] of [['normal', '#718ca9'], ['selected', '#9de1ce']]) {
   const marker = svg('marker', { id: 'arrow-' + name, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5.5, markerHeight: 5.5, orient: 'auto-start-reverse' });
   marker.append(svg('path', { d: 'M 1 1 L 9 5 L 1 9 z', fill: color }));
   defs.append(marker);
  }
  const filter = svg('filter', { id: 'card-shadow', x: '-20%', y: '-30%', width: '150%', height: '180%' });
  filter.append(svg('feDropShadow', { dx: 0, dy: 5, stdDeviation: 6, 'flood-color': '#000000', 'flood-opacity': '.18' }));
  defs.append(filter);
  return defs;
 }

 function renderDiagram(fit) {
  const edges = activeEdges();
  displayedNodes = chooseNodes(edges);
  const ids = new Set(displayedNodes.map((node) => node.id));
  displayedEdges = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
  graphElement.replaceChildren(createDefinitions());
  if (!graph.nodes.length) {
   showState('No source components found', 'Launch Pi Flow from a project containing supported source files, then rescan.', false);
   $('visible-count').textContent = '0 nodes · 0 connections';
   return;
  }
  $('canvas-state').hidden = true;
  const groups = layout(displayedNodes, displayedEdges);
  const boundaryLayer = svg('g', { 'aria-hidden': 'true' });
  for (const group of groups) {
   boundaryLayer.append(svg('rect', { class: 'boundary ' + group.boundary, x: group.x, y: group.y, width: group.width, height: group.height, rx: 12 }), svg('text', { class: 'boundary-label', x: group.x + 14, y: group.y + 20 }, group.label));
  }
  graphElement.append(boundaryLayer);
  const edgeLayer = svg('g', { id: 'edge-layer' });
  const labelLayer = svg('g', { id: 'label-layer', 'aria-hidden': 'true' });
  const parallelCounts = new Map();
  for (const edge of displayedEdges) {
   const key = [edge.source, edge.target].sort().join('|');
   const offsetIndex = parallelCounts.get(key) || 0;
   parallelCounts.set(key, offsetIndex + 1);
   renderEdge(edge, edgeLayer, labelLayer, offsetIndex);
  }
  graphElement.append(edgeLayer, labelLayer);
  const nodeLayer = svg('g', { id: 'node-layer' });
  for (const node of displayedNodes) nodeLayer.append(renderNode(node));
  graphElement.append(nodeLayer);
  $('visible-count').textContent = displayedNodes.length + ' of ' + graph.nodes.length + ' nodes · ' + displayedEdges.length + ' connections';
  applyHighlights();
  if (fit) fitGraph();
 }

 function renderEdge(edge, layer, labelLayer, offsetIndex) {
  const source = positions.get(edge.source);
  const target = positions.get(edge.target);
  if (!source || !target) return;
  let startX, startY, endX, endY, path, middleX, middleY;
  const offset = (offsetIndex % 4) * 12 - 8;
  if (Math.abs(source.x - target.x) < 10) {
   const right = source.x + source.width;
   startX = right; startY = source.y + source.height / 2 + offset;
   endX = target.x + target.width; endY = target.y + target.height / 2 + offset;
   const bend = 33 + offsetIndex * 12;
   path = 'M ' + startX + ' ' + startY + ' C ' + (right + bend) + ' ' + startY + ', ' + (right + bend) + ' ' + endY + ', ' + endX + ' ' + endY;
   middleX = right + bend * .72; middleY = (startY + endY) / 2;
  } else {
   const forward = target.x > source.x;
   startX = source.x + (forward ? source.width : 0);
   endX = target.x + (forward ? 0 : target.width);
   startY = source.y + source.height / 2 + offset;
   endY = target.y + target.height / 2 + offset;
   const bend = Math.max(45, Math.abs(endX - startX) * .43);
   path = 'M ' + startX + ' ' + startY + ' C ' + (startX + (forward ? bend : -bend)) + ' ' + startY + ', ' + (endX + (forward ? -bend : bend)) + ' ' + endY + ', ' + endX + ' ' + endY;
   middleX = (startX + endX) / 2; middleY = (startY + endY) / 2 + offsetIndex * 13;
  }
  const line = svg('path', { d: path, class: 'graph-edge ' + edge.kind, 'data-edge-id': edge.id, 'marker-end': 'url(#arrow-normal)' });
  const hit = svg('path', { d: path, class: 'edge-hit', tabindex: 0, role: 'button', 'aria-label': nodeById(edge.source).label + ' to ' + nodeById(edge.target).label + ': ' + edge.label });
  hit.append(svg('title', {}, edge.label + ' · ' + edge.confidence + ' · ' + edge.count + ' source occurrences'));
  hit.addEventListener('click', (event) => { event.stopPropagation(); selectEdge(edge.id); });
  hit.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectEdge(edge.id); } });
  layer.append(line, hit);
  // Label the selected connection and one representative per pair; all remain inspectable.
  if (offsetIndex === 0 && (displayedEdges.length <= 8 || selectedNode && (edge.source === selectedNode || edge.target === selectedNode)) || edge.id === selectedEdge) {
   const label = shorten(edge.label, 24);
   const labelWidth = Math.max(40, label.length * 6.5 + 14);
   const group = svg('g', { class: 'edge-label-group', 'data-label-edge': edge.id });
   group.append(svg('rect', { class: 'edge-label-bg', x: middleX - labelWidth / 2, y: middleY - 10, width: labelWidth, height: 18, rx: 4 }), svg('text', { class: 'edge-label', x: middleX, y: middleY + 2, 'text-anchor': 'middle' }, label));
   labelLayer.append(group);
  }
 }

 function renderNode(node) {
  const position = positions.get(node.id);
  const group = svg('g', { class: 'graph-node', transform: 'translate(' + position.x + ' ' + position.y + ')', 'data-node-id': node.id, 'data-kind': node.kind, tabindex: 0, role: 'button', 'aria-label': node.label + ', ' + node.kind + ', ' + node.files.length + ' source files' });
  group.append(svg('title', {}, node.label + '\n' + node.description));
  group.append(svg('rect', { class: 'node-box', width: position.width, height: position.height, rx: 9 }));
  group.append(svg('rect', { class: 'node-accent', x: 0, y: 22, width: 2, height: 45, rx: 1 }));
  group.append(svg('rect', { class: 'node-icon-box', x: 12, y: 12, width: 22, height: 22, rx: 5 }));
  const icons = { entry: 'M17 18l5 5-5 5m8 0h5', process: 'M17 18h5v5h-5Zm8 0h5v5h-5Zm-8 8h5v5h-5Zm8 0h5v5h-5Z', store: 'M17 19c0-4 13-4 13 0v9c0 4-13 4-13 0Zm0 0c0 4 13 4 13 0m-13 5c0 4 13 4 13 0', external: 'M17 24h13m-6-7v13m-7-6a7 7 0 1 0 14 0 7 7 0 1 0-14 0' };
  group.append(svg('path', { class: 'node-icon', d: icons[node.kind], transform: 'translate(-1 -1) scale(.95)' }));
  group.append(svg('text', { class: 'node-kind', x: 43, y: 26 }, node.kind === 'entry' ? 'ENTRY POINT' : node.kind === 'store' ? 'DATA STORE' : node.kind.toUpperCase()));
  group.append(svg('text', { class: 'node-title', x: 14, y: 53 }, shorten(node.label, 22)));
  const subtitle = node.files.length ? commonPath(node.files) : node.boundary === 'network' ? 'outside project · network' : 'outside project · local host';
  group.append(svg('text', { class: 'node-subtitle', x: 14, y: 72 }, shorten(subtitle, 28)));
  if (node.files.length) group.append(svg('text', { class: 'node-files', x: position.width - 12, y: 26, 'text-anchor': 'end' }, node.files.length + ' files'));
  group.append(svg('circle', { class: 'port', cx: 0, cy: position.height / 2, r: 3 }), svg('circle', { class: 'port', cx: position.width, cy: position.height / 2, r: 3 }));
  group.addEventListener('click', (event) => { event.stopPropagation(); selectNode(node.id, false); });
  group.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectNode(node.id, false); } });
  return group;
 }

 function commonPath(files) {
  if (!files.length) return '';
  const parts = files[0].split('/');
  parts.pop();
  while (parts.length && !files.every((file) => file.startsWith(parts.join('/') + '/'))) parts.pop();
  return parts.length ? parts.join('/') + '/' : files.length === 1 ? files[0] : './';
 }

 function selectNode(id, ensureVisible) {
  const wasDisplayed = positions.has(id);
  selectedNode = id;
  selectedEdge = null;
  $('workspace').classList.add('has-selection');
  if (ensureVisible && !wasDisplayed) renderDiagram(true);
  else renderDiagram(false);
  renderSidebar();
  renderInspector();
 }
 function selectEdge(id) {
  selectedEdge = id;
  selectedNode = null;
  $('workspace').classList.add('has-selection');
  renderDiagram(false);
  renderSidebar();
  renderInspector();
 }
 function clearSelection() {
  selectedNode = null; selectedEdge = null;
  $('workspace').classList.remove('has-selection');
  if (!graph) return;
  applyHighlights(); renderSidebar(); renderInspector();
 }

 function applyHighlights() {
  const query = $('search').value.trim().toLowerCase();
  const selected = selectedEdge ? graph.edges.find((edge) => edge.id === selectedEdge) : null;
  const connectedNodes = new Set(selectedNode ? [selectedNode] : selected ? [selected.source, selected.target] : []);
  if (selectedNode) for (const edge of displayedEdges) if (edge.source === selectedNode || edge.target === selectedNode) { connectedNodes.add(edge.source); connectedNodes.add(edge.target); }
  const selectionActive = Boolean(selectedNode || selectedEdge);
  for (const group of graphElement.querySelectorAll('[data-node-id]')) {
   const id = group.getAttribute('data-node-id');
   const node = nodeById(id);
   group.classList.toggle('selected', id === selectedNode || Boolean(selected && (id === selected.source || id === selected.target)));
   group.classList.toggle('faded', selectionActive ? !connectedNodes.has(id) : Boolean(query && !matchesSearch(node, query)));
   group.setAttribute('aria-pressed', String(id === selectedNode));
  }
  for (const path of graphElement.querySelectorAll('[data-edge-id]')) {
   const edge = graph.edges.find((item) => item.id === path.getAttribute('data-edge-id'));
   const highlighted = edge.id === selectedEdge || Boolean(selectedNode && (edge.source === selectedNode || edge.target === selectedNode));
   path.classList.toggle('selected', highlighted);
   path.classList.toggle('faded', selectionActive && !highlighted);
   path.setAttribute('marker-end', highlighted ? 'url(#arrow-selected)' : 'url(#arrow-normal)');
  }
  for (const label of graphElement.querySelectorAll('[data-label-edge]')) {
   const edge = graph.edges.find((item) => item.id === label.getAttribute('data-label-edge'));
   const highlighted = edge.id === selectedEdge || Boolean(selectedNode && (edge.source === selectedNode || edge.target === selectedNode));
   label.classList.toggle('selected', highlighted);
   label.classList.toggle('faded', selectionActive && !highlighted);
  }
 }

 function section(parent, title) {
  const result = element('section', 'inspect-section');
  result.append(element('h3', '', title));
  parent.append(result);
  return result;
 }
 function pair(parent, name, value) { const row = element('div', 'inspect-pair'); row.append(element('span', '', name), element('span', '', value)); parent.append(row); }
 function renderInspector() {
  const parent = $('inspector-content');
  parent.replaceChildren();
  if (!graph) return;
  if (selectedEdge) { renderEdgeInspector(parent, graph.edges.find((edge) => edge.id === selectedEdge)); return; }
  if (selectedNode) { renderNodeInspector(parent, nodeById(selectedNode)); return; }
  const kind = element('span', 'inspect-kind', 'Project overview');
  kind.dataset.kind = 'entry';
  parent.append(kind, element('h2', '', graph.project.name), element('p', 'inspect-description', 'An evidence-backed view of how this project reads, transforms, and moves data.'));
  if (pageOptions.hosted) {
   const local = element('div', 'run-locally', 'Map your own codebase with the Pi fork. Launch it from your project directory:');
   local.append(element('code', 'mono', 'pi flow'));
   const docs = element('a', '', 'View source and setup');
   docs.href = 'https://github.com/allsmog/pi-mono/tree/flow/project-data-flow';
   docs.target = '_blank'; docs.rel = 'noopener noreferrer';
   local.append(docs); parent.append(local);
  }
  const project = section(parent, pageOptions.hosted ? 'Example source tree' : 'Current project');
  project.append(element('p', 'path-text', graph.project.root));
  const details = section(parent, 'Scan coverage');
  pair(details, 'Source files', number(graph.project.fileCount));
  pair(details, 'Source lines', number(graph.project.lineCount));
  pair(details, 'Scan duration', graph.project.durationMs < 1000 ? graph.project.durationMs + ' ms' : (graph.project.durationMs / 1000).toFixed(2) + ' s');
  pair(details, 'Analysis', pageOptions.hosted ? 'Static · saved snapshot' : 'Static · local');
  const tags = element('div', 'tag-list');
  graph.project.languages.slice(0, 8).forEach((language) => tags.append(element('span', 'tag', language)));
  details.append(tags);
  const connections = section(parent, 'Explore a data flow');
  const strongest = graph.edges.filter((edge) => edge.kind !== 'dependency').sort((a, b) => b.count - a.count).slice(0, 3);
  if (strongest.length) strongest.forEach((edge) => connections.append(connectionButton(edge)));
  else connections.append(element('p', 'inspect-empty', 'No supported I/O relationships were detected. Enable Dependencies to inspect module relationships.'));
  parent.append(element('p', 'inspect-note', 'Select a component or connection to inspect its source evidence. Inferred connections are identified explicitly.'));
  renderWarnings(parent);
 }
 function renderWarnings(parent) {
  if (!graph.warnings || !graph.warnings.length) return;
  const warnings = section(parent, 'Coverage notes');
  graph.warnings.forEach((warning) => warnings.append(element('p', 'inspect-note warning', warning)));
 }
 function renderNodeInspector(parent, node) {
  const kind = element('span', 'inspect-kind', node.kind === 'entry' ? 'Entry point' : node.kind === 'store' ? 'Data store' : titleCase(node.kind));
  kind.dataset.kind = node.kind;
  parent.append(kind, element('h2', '', node.label), element('p', 'inspect-description', node.description));
  const info = section(parent, 'Component details');
  pair(info, 'Boundary', titleCase(node.boundary));
  pair(info, 'Source files', number(node.files.length));
  const flows = graph.edges.filter((edge) => edge.kind !== 'dependency' && (edge.source === node.id || edge.target === node.id));
  pair(info, 'Data flows', number(flows.length));
  if (node.technologies.length) { const tags = element('div', 'tag-list'); node.technologies.forEach((tech) => tags.append(element('span', 'tag', tech))); info.append(tags); }
  const connections = section(parent, 'Connected data flows');
  if (!flows.length) connections.append(element('p', 'inspect-empty', 'No supported I/O operations were detected for this component. Dependency edges can still show source relationships.'));
  flows.slice().sort((a, b) => b.count - a.count).slice(0, 10).forEach((edge) => connections.append(connectionButton(edge, node.id)));
  if (flows.length > 10) connections.append(element('p', 'inspect-empty', 'Showing 10 of ' + flows.length + ' connections. Export the graph for the complete set.'));
  const evidence = flows.flatMap((edge) => edge.evidence).filter((item) => node.files.includes(item.file));
  if (evidence.length) { const sources = section(parent, 'Source evidence'); uniqueEvidence(evidence).slice(0, 4).forEach((item) => sources.append(evidenceCard(item))); }
  if (node.files.length) {
   const files = section(parent, 'Source files');
   node.files.slice(0, 7).forEach((file) => { const card = element('div', 'file-card'); card.append(element('p', 'path-text', file)); files.append(card); });
   if (node.files.length > 7) { const show = element('button', 'button', 'View all ' + node.files.length + ' files'); show.type = 'button'; show.addEventListener('click', () => showSourceIndex(node.id)); files.append(show); }
  }
 }
 function renderEdgeInspector(parent, edge) {
  const kind = element('span', 'inspect-kind', titleCase(edge.kind) + ' connection');
  kind.dataset.kind = edge.kind === 'read' || edge.kind === 'write' ? 'store' : edge.kind === 'network' ? 'external' : 'entry';
  parent.append(kind, element('h2', '', edge.label), element('p', 'inspect-description', nodeById(edge.source).label + ' → ' + nodeById(edge.target).label));
  const details = section(parent, 'Connection details');
  pair(details, 'Type', titleCase(edge.kind));
  pair(details, 'Evidence', titleCase(edge.confidence));
  pair(details, 'Occurrences', number(edge.count));
  pair(details, 'Source boundary', titleCase(nodeById(edge.source).boundary));
  pair(details, 'Target boundary', titleCase(nodeById(edge.target).boundary));
  const evidence = section(parent, 'Source evidence');
  edge.evidence.forEach((item) => evidence.append(evidenceCard(item)));
  if (!edge.evidence.length) evidence.append(element('p', 'inspect-empty', 'No source excerpt was recorded for this relationship.'));
  if (edge.count > edge.evidence.length) evidence.append(element('p', 'inspect-empty', edge.evidence.length + ' excerpts shown from ' + edge.count + ' detected occurrences.'));
  parent.append(element('p', 'inspect-note' + (edge.confidence === 'inferred' ? ' warning' : ''), edge.confidence === 'inferred' ? 'Inferred from source structure or naming. Verify the behavior in the linked code before treating it as a runtime data flow.' : 'Detected in source code. Execution, reachability, and the data carried by this connection are not verified at runtime.'));
 }
 function connectionButton(edge, relativeId) {
  const button = element('button', 'connection-item');
  button.type = 'button';
  const title = relativeId ? (edge.source === relativeId ? '→ ' + nodeById(edge.target).label : '← ' + nodeById(edge.source).label) : shorten(nodeById(edge.source).label, 22) + ' → ' + shorten(nodeById(edge.target).label, 22);
  const top = element('span', 'connection-topline');
  top.append(element('span', '', title));
  const lower = element('span', 'connection-kind');
  lower.append(element('span', '', edge.label), element('span', 'confidence' + (edge.confidence === 'inferred' ? ' inferred' : ''), edge.confidence));
  button.append(top, lower);
  button.addEventListener('click', () => { if (!positions.has(edge.source) || !positions.has(edge.target)) { $('scope').value = 'all'; renderDiagram(true); } selectEdge(edge.id); });
  return button;
 }
 function evidenceCard(evidence) {
  const card = element('div', 'file-card');
  card.append(element('div', 'evidence-location', evidence.file + ':' + evidence.line), element('pre', 'evidence-code', evidence.text));
  return card;
 }
 function uniqueEvidence(evidence) { const seen = new Set(); return evidence.filter((item) => { const key = item.file + ':' + item.line; if (seen.has(key)) return false; seen.add(key); return true; }); }

 function applyView() {
  graphElement.setAttribute('viewBox', [view.x, view.y, view.width, view.height].join(' '));
  $('zoom-value').textContent = Math.round(fittedWidth / view.width * 100) + '%';
 }
 function fitGraph() {
  const rect = graphElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const scale = Math.max(bounds.width / rect.width, bounds.height / rect.height) * 1.08;
  view = { x: bounds.width / 2 - rect.width * scale / 2, y: bounds.height / 2 - rect.height * scale / 2, width: rect.width * scale, height: rect.height * scale };
  fittedWidth = view.width;
  applyView();
 }
 function zoom(factor, x, y) {
  const rect = graphElement.getBoundingClientRect();
  const relativeX = x === undefined ? .5 : (x - rect.left) / rect.width;
  const relativeY = y === undefined ? .5 : (y - rect.top) / rect.height;
  const newWidth = Math.max(fittedWidth / 4, Math.min(fittedWidth * 3, view.width * factor));
  const ratio = newWidth / view.width;
  const newHeight = view.height * ratio;
  view = { x: view.x + (view.width - newWidth) * relativeX, y: view.y + (view.height - newHeight) * relativeY, width: newWidth, height: newHeight };
  applyView();
 }
 graphElement.addEventListener('wheel', (event) => { if (!graph) return; event.preventDefault(); zoom(event.deltaY > 0 ? 1.1 : .9, event.clientX, event.clientY); }, { passive: false });
 graphElement.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target.closest('.graph-node,.edge-hit')) return;
  drag = { x: event.clientX, y: event.clientY, startX: view.x, startY: view.y, moved: false };
  graphElement.setPointerCapture(event.pointerId);
  graphElement.classList.add('dragging');
 });
 graphElement.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const rect = graphElement.getBoundingClientRect();
  if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 3) drag.moved = true;
  view.x = drag.startX - (event.clientX - drag.x) / rect.width * view.width;
  view.y = drag.startY - (event.clientY - drag.y) / rect.height * view.height;
  applyView();
 });
 graphElement.addEventListener('pointerup', () => { if (drag && !drag.moved) clearSelection(); drag = null; graphElement.classList.remove('dragging'); });
 graphElement.addEventListener('pointercancel', () => { drag = null; graphElement.classList.remove('dragging'); });
 graphElement.addEventListener('keydown', (event) => {
  if (event.target !== graphElement) return;
  const movement = view.width * .06;
  if (event.key === '+' || event.key === '=') zoom(.8);
  else if (event.key === '-') zoom(1.25);
  else if (event.key === 'ArrowLeft') view.x -= movement;
  else if (event.key === 'ArrowRight') view.x += movement;
  else if (event.key === 'ArrowUp') view.y -= movement;
  else if (event.key === 'ArrowDown') view.y += movement;
  else return;
  event.preventDefault(); applyView();
 });

 function showSourceIndex(componentId) {
  if (!graph) return;
  const files = componentId ? graph.files.filter((file) => file.componentId === componentId) : graph.files;
  $('source-title').textContent = componentId ? nodeById(componentId).label + ' · source files' : 'Source index';
  $('source-note').textContent = number(files.length) + ' analyzed files. Select a file to inspect its component.';
  $('source-rows').replaceChildren();
  for (const file of files) {
   const row = element('tr');
   const name = element('td');
   const button = element('button', 'file-button', file.path);
   button.type = 'button';
   button.addEventListener('click', () => { $('source-dialog').close(); selectNode(file.componentId, true); });
   name.append(button);
   row.append(name, element('td', 'subtle', file.language), element('td', 'mono subtle', number(file.lines)));
   $('source-rows').append(row);
  }
  $('source-dialog').showModal();
 }
 function download(content, extension, mime) {
  if (!graph) return;
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = graph.project.name.replace(/[^a-z0-9._-]/gi, '-') + '-flow.' + extension;
  document.body.append(link);
  link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('export-menu').open = false;
  announce('Exported ' + extension.toUpperCase() + ' graph');
 }
 function mermaid() {
  const ids = new Map(graph.nodes.map((node, index) => [node.id, 'n' + index]));
  const escape = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/[\r\n]/g, ' ').replace(/[<>]/g, '').replace(/\|/g, '&#124;');
  const lines = ['flowchart LR', '  %% Static source relationships; not a runtime trace.'];
  for (const boundary of ['project', 'host', 'network']) {
   const nodes = graph.nodes.filter((node) => node.boundary === boundary);
   if (!nodes.length) continue;
   lines.push('  subgraph ' + boundary + '["' + titleCase(boundary) + '"]');
   for (const node of nodes) lines.push('    ' + ids.get(node.id) + '["' + escape(node.label) + '"]');
   lines.push('  end');
  }
  for (const edge of activeEdges()) lines.push('  ' + ids.get(edge.source) + (edge.kind === 'dependency' ? ' -.->|' : ' -->|') + escape(edge.label + (edge.confidence === 'inferred' ? ' (inferred)' : '')) + '| ' + ids.get(edge.target));
  return lines.join('\n') + '\n';
 }

 $('rescan').addEventListener('click', () => load(true));
 $('retry').addEventListener('click', () => load(false));
 $('overview').addEventListener('click', () => { $('search').value = ''; $('scope').value = 'overview'; selectedNode = null; selectedEdge = null; $('workspace').classList.remove('has-selection'); if (graph) { renderSidebar(); renderDiagram(true); renderInspector(); } });
 $('close-inspector').addEventListener('click', clearSelection);
 $('source-index').addEventListener('click', () => showSourceIndex());
 $('close-sources').addEventListener('click', () => $('source-dialog').close());
 $('source-dialog').addEventListener('click', (event) => { if (event.target === $('source-dialog')) { const rect = $('source-dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('source-dialog').close(); } });
 $('search').addEventListener('input', () => { if (graph) { renderSidebar(); renderDiagram(true); } });
 $('dependencies').addEventListener('change', () => { if (graph) { selectedEdge = null; renderDiagram(true); renderInspector(); } });
 $('scope').addEventListener('change', () => { if (graph) renderDiagram(true); });
 $('fit').addEventListener('click', fitGraph);
 $('zoom-in').addEventListener('click', () => zoom(.8));
 $('zoom-out').addEventListener('click', () => zoom(1.25));
 $('export-json').addEventListener('click', () => { if (graph) download(JSON.stringify(graph, null, 2) + '\n', 'json', 'application/json'); });
 $('export-mermaid').addEventListener('click', () => { if (graph) download(mermaid(), 'mmd', 'text/plain'); });
 $('example-select').addEventListener('change', () => { selectedNode = null; selectedEdge = null; $('search').value = ''; $('scope').value = 'overview'; $('workspace').classList.remove('has-selection'); showState('Loading example codebase', 'Reading its saved source-analysis snapshot.', false); load(false); });
 document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { clearSelection(); $('export-menu').open = false; }
  if (event.key.toLowerCase() === 'f' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); fitGraph(); }
 });
 new ResizeObserver(() => { if (graph) fitGraph(); }).observe($('canvas'));
 if (pageOptions.hosted) {
  document.body.classList.add('hosted');
  $('example-switcher').hidden = false;
  for (const example of pageOptions.examples || []) { const option = element('option', '', example.label); option.value = example.id; $('example-select').append(option); }
  $('session-label').textContent = 'Saved source scan';
  $('rescan-label').textContent = 'Refresh example';
  $('rescan').setAttribute('aria-label', 'Refresh example');
  $('sidebar-mode').textContent = 'Example codebase';
  $('sidebar-mode-detail').textContent = 'Saved analysis snapshot';
  $('page-kicker').textContent = 'Explore an example codebase';
  $('page-description').textContent = 'Explore real source relationships. Select a component to inspect its evidence.';
  $('scan-mode').textContent = 'Saved source scan';
 }
 load(false);
})();
</script>
</body>
</html>`;
}
