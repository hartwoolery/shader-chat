

var chatHistory = [];
var isLoading = false;
var myInterval = null;

var startLoading = function(doLoad) {


	if (doLoad) {
		myInterval = setInterval(function() {
			if (isLoading) {
				counter = (counter + 1) % frames.length;
				$('#last-chat').html(frames[counter].replaceAll(' ', '&nbsp;'))
			}
		}, 80);
	} else {
		clearInterval(myInterval);
	}

	isLoading = doLoad
	var func = doLoad ? 'addClass' : 'removeClass'
	$('#go')[func]('btn-disabled loading')
	$('#chat-input')[func]('input-disabled')
	$('#go').text(doLoad ? '' : 'GO');
	if (!doLoad) $('#last-chat').html(chatHistory[chatHistory.length - 1]);
}


var runCode = function () {
	//console.log("run!")
	let code = document.editor.state.doc.toString();
	$('#fs').text(code);

	setupWebGL();
}

window.onmessage = function(e) {
	if (e.data == "ready") {
		runCode()
	}
}

$('#run').click(runCode)

var counter = 0;
var frames = [
	"( ●    )",
	"(  ●   )",
	"(   ●  )",
	"(    ● )",
	"(     ●)",
	"(    ● )",
	"(   ●  )",
	"(  ●   )",
	"( ●    )",
	"(●     )"
]

//var answerArr = ['Done!', 'Voila!', 'How\'s this?', 'Presto!', 'Bam!', 'Like this?'];


const scrollSmoothlyToBottom = (id) => {
    const element = $(`#${id}`);
    element.animate({
        scrollTop: element.prop("scrollHeight")
    }, 500);
}

var updateChatBox = function(){
	var html = ''
	for (var i=0; i<chatHistory.length; i++) {
		var isStart = i%2 == 1;
		var idStr = '';
		if (i == chatHistory.length - 1) idStr = ' id="last-chat"';
		html += 	'<div class="chat chat-' + (isStart ? 'start' : 'end') + '">';
		html += 		'<div'+ idStr +' class="chat-bubble chat-bubble-' + (isStart ? 'secondary' : 'primary') + '">' + chatHistory[i].replaceAll('\n', '<br>') + '</div>';
		html += 	'</div>';
	}
	$('#chatbox').html(html);
	scrollSmoothlyToBottom('chatbox');
}

$('#chat').submit(function () {
	if (isLoading) return false;
	var clearHistory = $('#clearHistory').is(":checked");
	
	var input = $('#chat-input').val();
	$('#chat-input').val('');
	if (clearHistory) {
		highlightCode($('#fsbase').text());
		chatHistory = [];
		$('#clearHistory').prop("checked", false);
	}
	chatHistory.push(input);
	var answer = '';//answerArr[Math.floor(Math.random() * answerArr.length)];

	chatHistory.push(answer)
	updateChatBox();
	var doHelp = input.toLowerCase().includes("help");
	var code = document.editor.state.doc.toString();
	var commentCode = $('#commentCode').is(":checked");
	var model = $('#useGPT4').is(":checked") && !doHelp ? "gpt-4" : "gpt-3.5-turbo"

	startLoading(true)

	fetch('/completion', {
		method: 'POST',
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ 
			"input": input,
			"commentCode": commentCode,
			"model": model,
			"code": code,
			"help": doHelp
		})
	})
	.then(async function(response) {

		startLoading(false)
	  	if(response.ok) {
			var res = await response.json()
			console.log(res)
			if (res.help === true) {
				
			} else {
				highlightCode(res.glsl)

				if (res.glsl != '') setupWebGL();
			}
			chatHistory[chatHistory.length - 1] = res.content;
			updateChatBox();
			return false;
		}
		else throw new Error('Request failed.');
	})
	.catch(function(error) {
	  console.log(error)
	  startLoading(false);
	});
	return false;
});

var setError = function(error) {
	if (error.length == 0) {
		$('#error-alert').hide()
	} else {
		$('#error-alert').show()
	}
	var str = 'Error compiling FRAGMENT_SHADER: ';

	$('#error-text').text(error.substr(error.indexOf(str) + str.length));
}

/*
Prism.languages.glsl.cn_input = /input_\S+/
Prism.languages.glsl.cn_output = /output_\S+/
*/
var highlightCode = function(code) {
	let editor = document.editor;
	//var highlighted = code.trim();//Prism.highlight(code.trim(), Prism.languages.glsl, 'glsl');
	editor.dispatch({
		changes: {from: 0, to: editor.state.doc.length, insert: code.trim()}
	});

	  
	//editor.setValue(highlighted); 
}

var str = "void main() { \n \
vec2 st = gl_FragCoord.xy/vec2(400,400);\n \
		float d = distance(st, vec2(0.5,0.5));\n \
		gl_FragColor = mix(vec4(1,0,0,1), vec4(0,0,0,0), d);\n \
}"


function setupWebGL () {
	setError('');
	const gl = document.getElementById("canvas").getContext("webgl2");

	const programInfo = twgl.createProgramInfo(gl, ["vs", "fs"], null, function(error) {
		setError(error)
	});

	var code = document.editor.state.doc.toString();
	code = code.replace('#version 300 es', '');
	code = code.replace('precision highp float;', '');
	code = code.replace('precision highp int;', '');
	code = code.replace('out vec4 fragColor;', 'uniform sampler2D alphaTexture;')
	code = code.replace(/(fragColor.*,)(.*)\)/gm, '$1texture2D(alphaTexture, vUv).r * $2)')
	code = code.replaceAll('fragColor', 'gl_FragColor')
	$('#8th')[0].contentWindow.postMessage(code, '*');


	const arrays = {
	position: { numComponents: 3, data: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0]},
	};
	const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
	
	function render(time) {
		twgl.resizeCanvasToDisplaySize(gl.canvas);
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

		const uniforms = {
			timeMsec: time,
			//resolution: [gl.canvas.width, gl.canvas.height],
		};
		if (programInfo && programInfo.program) {
			gl.useProgram(programInfo.program);
			twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
			twgl.setUniforms(programInfo, uniforms);
			twgl.drawBufferInfo(gl, bufferInfo);
		
			requestAnimationFrame(render);
		}
	
	}
	requestAnimationFrame(render);


		
	
}



var baseCode = $('#fs').text();
baseCode = baseCode.replace('fragColor = vec4(1.,1.,1.,1.);', 'float f = sin(time * 0.01 + (vUv.x + vUv.y) * 50.);\n\n\t//the output color of the shader\n\tfragColor = vec4(1.,f,1.,f);');
highlightCode(baseCode);//"//code will appear here...");

setupWebGL()


////////////////////////////// SELECTION
/*
function selectText(id){
	var sel, range;
	var el = document.getElementById(id); //get element id
	if (window.getSelection && document.createRange) { //Browser compatibility
	  sel = window.getSelection();
	  if(sel.toString() == ''){ //no text selection
		 window.setTimeout(function(){
			range = document.createRange(); //range object
			range.selectNodeContents(el); //sets Range
			sel.removeAllRanges(); //remove all ranges from selection
			sel.addRange(range);//add Range to a Selection.
		},1);
	  }
	} else if (document.selection) { //older ie
		sel = document.selection.createRange();
		if(sel.text == ''){ //no text selection
			range = document.body.createTextRange();//Creates TextRange object
			range.moveToElementText(el);//sets Range
			range.select(); //make selection.
		}
	}
}

$(document).keydown(function(e) {
	if ((e.keyCode == 65 ) && (e.ctrlKey || e.metaKey) && !$('#chat-input').is(':focus')) {
		selectText('output')
		e.preventDefault();
	}
});*/