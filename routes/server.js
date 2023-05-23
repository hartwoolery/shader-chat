var express = require('express');
var router = express.Router();

var indent = require('indent.js');
var dotenv = require('dotenv');

dotenv.config();

const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}); 

const openai = new OpenAIApi(configuration);

async function test() {
	const response = await openai.listModels();
	console.log(response.data)
}


var baseCode = "#version 300 es\n#ifdef GL_ES\nprecision mediump float;\n#endif\n\n\
// Define the resolution of the screen\nuniform vec2 resolution;\n\n\
//the current elapsed time\nuniform float time;\n\n\
//the output fragment color\nout vec4 fragColor;\n\n";

router.post('/completion', function(req,res,next) {

	var prompt = req.body.input.trim();
	var doHelp = req.body.help;
	var code = req.body.code;
	var commentCode = req.body.commentCode;
	console.log(prompt)
	if (!prompt) {

		res.send({glsl:'' });
		return;
	}

	var messages = []
	if (doHelp) {
		messages.push({"role": "system", "content": "Your job is to help me write WebGL 2.0 fragment shaders.  You are to give me ideas of things I can ask you to write these shaders."})
	} else {
		messages.push({"role": "system", "content": "You write all responses as WebGL 2.0 fragment shaders. Please include any code inside code blocks with ```"});
		if (commentCode) messages.push({"role": "assistant", "content": "The code you write should include a single-line comment above each line of code."});
		else messages.push({"role": "assistant", "content": "The code you write should not have any comments"});
		messages.push({"role": "user", "content": "Use the following code as a starting point:"})
		
		messages.push({"role": "user", "content": code})
	}
	messages.push({"role": "user", "content": prompt})
	

	console.log(req.body.model);
	openai.createChatCompletion({
		model: req.body.model,
		messages: messages,
	}).then((response) => {
		// Sending the response data back to the client
		try {
			var choice = response.data.choices[0];
			var content = choice.message.content.trim();
			var cleaned = cleanCode(content);
			

			var result = {
				glsl: cleaned.glsl,
				help: doHelp,
				content: cleaned.content
			}
			console.log(doHelp)
			res.send(result);  
		} catch(e) {
			console.log(e);
		}

		
	}).catch(error => {
		console.error(error);
		res.status(500).send({text:'An error occurred'});
	});
});

const cleanCode = (content) => {
	

	console.log(content);

	const rt = (regex, replacement) => {
		content =  content.replace(regex, replacement);
	}

	const ft = (regex) => {
		return content.search(regex) > -1;
	}

	
	let contentStripped = content;

	//strip code blocks
	if (ft(/```/gm)) {
		contentStripped = content.replace(/```([\S\s]*)```/gm, '');
		rt(/[\S\s]*```([\S\s]*)```[\S\s]*/gm, '$1');
	}


	//strip instances of 'cpp' or 'glsl' that get placed in code
	rt(/.*cpp;?\n|.*glsl;?\n/gmi, '')

	
	//ensure version is line 0;
	if (content.indexOf('#version') != 0) {
		rt(/#version.*/gm, '')
		rt(/#ifdef\s*GL_ES[\s\S]*#endif/gm, '')
		content = "#version 300 es\n#ifdef GL_ES\nprecision mediump float;\n#endif\n\n" + content;
	}

	//add in WebGL req
	//if (!ft(/#version.*\s*/gm)) content = '#version 300 es\n#ifdef GL_ES\nprecision mediump float;\n#endif\n\n'+content;
	//fix mod ops
	rt(/=[\s\S]*?(.*?)\s*%\s*(.*);/gm, '= mod($1, $2)');;
	//rt(/(\s*mod\s*\()([\s\S]*?)\s*,\s*([\s\S]*?)\)/gm, '$1float($2),float($3))');

	rt(/(\s+)gl\SFragColor(\s*)/gm, '$1fragColor$2');
	

	if (!ft(/out vec4 fragColor/gm)) rt(/void\s*main\s*\(\s*\)[\S\s]*{/gm, 'out vec4 fragColor;\n\nvoid main() {\n');
	
	//beautify
	var glsl = indent.js(content, {tabString: '\t'});

	return {glsl:glsl.trim(), content: contentStripped.trim()};
}


module.exports = router;

/*
const glslToCodeNode = (isVertex, input) => {
	if (input.length == 0) return;

	const ft = (regex) => {
		return input.search(regex) > -1;
	}

	const rt = (regex, replacement) => {
		input =  input.replace(regex, replacement);
	}

	const addDefinition = (variable, value) => {
		input = '#define ' + variable + ' ' + value + '\n' + input;
	}

	const addInput = (txt, inputType, description) => {
		input = '// '+ description + '\n' + inputType + ' ' + txt + ';\n\n' + input
	}

	rt(/(r|R|u_r)esolution/gm, 'iResolution')
	rt(/(t|T|u_t)ime/gm, 'iTime')

	input = '\nvec2 getResolution() {\nif (resolution.x == 0.) return vec2(640,640); return resolution;\n}\n\n' + input;

	//vertex or fragment outputs
	//if (isVertex) addInput('positionOut', 'output_vec3', 'The output vertex position');
	//else addInput('colorOut', 'output_vec4', 'The output fragment color');
	
	
	//resolution and time


	addInput('resolution', 'input_vec2', 'The shader resolution');
	addDefinition('iResolution', 'getResolution()')
	addDefinition('iTime', 'system.getTimeElapsed()');
	addDefinition('fragCoord', 'vec4(system.getSurfaceUVCoord0()*getResolution(),1.,1.)')

	//remove excess defines and comments
	rt(/precision\s*mediump\s*float\s*;\s*          /gm, '');
	rt(/#ifdef\s*GL_ES[\S\s]*#endif\s*              /gm, '');
	rt(/#version.*\s*             					/gm, '');


	//code node inputs and outputs
	rt(/(\s+)(uniform\s+sampler2D\s*) /gm, '$1input_texture_2d ');
	rt(/(\s+)uniform(\s+)/gm, '$1input_');
	rt(/(\s+)varying(\s+)/gm, '$1input_');
	rt(/(\s+)attribute(\s+)/gm, '$1input_');
	rt(/(\s+)in(\s+)/gm, '$1input_');
	rt(/(\s+)out(\s+)/gm, '$1output_');

	//remove inputs 
	rt(/input_float iTime;\s*						/gm, '');
	rt(/input_vec2 iResolution;\s*					/gm, '');

	//texture samples
	rt(/(\s*)texture2D\(\s*(\S*)\s*,(.*)\)/gm, '$1$2.sample($3)');

	//fragCoord
	//rt(/gl\SFragCoord\.xy\s*\/[\s\S]*resolution/gm, 'system.getSurfaceUVCoord0()')
	rt(/gl\SFragCoord/gm, 'fragCoord');
	rt(/fragCoord.xy\s*\/\s*iResolution.xy/gm, 'system.getSurfaceUVCoord0()');

	//output color
	//rt(/(\s+)gl\SFragColor(\s*)/gm, '$1colorOut$2');

	//output position
	rt(/(\s+)gl\SPosition(\s*)/gm, '$1vec4 glPos$2');

	if (isVertex) {
		//to Cartesian coordinate
		rt(/(void\s*main\s*\(\s*\)[\S\s]*{[\S\s]*)(})/gm, '$1\npositionOut = glPos.xyz / glPos.w;\n$2')
	}
	
	input = indent.js(input, {tabString: '\t'});
	
	return input;

  }
*/  





