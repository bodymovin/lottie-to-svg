const puppeteer = require('puppeteer');
var xml2js = require('xml2js');
var parseString = require('xml2js').parseString;
// var parser = new xml2js.Parser({explicitArray: true, explicitChildren: true, preserveChildrenOrder: true});
// var parser = new xml2js.Parser();
var convert = require('xml-js');
var saveTemplate = require('./testTemplate');
var formatValue = require('./valueFormatter');

var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs")
    port = process.argv[2] || 8888;

http.createServer(function(request, response) {

  var uri = url.parse(request.url).pathname
    , filename = path.join(process.cwd(), 'pages\\' + uri);

  var contentTypesByExtension = {
    '.html': "text/html",
    '.css':  "text/css",
    '.js':   "text/javascript"
  };

  fs.exists(filename, function(exists) {
  	console.log(filename)
    if(!exists) {
      response.writeHead(404, {"Content-Type": "text/plain"});
      response.write("404 Not Found\n");
      response.end();
      return;
    }

    if (fs.statSync(filename).isDirectory()) filename += '/index.html';

    fs.readFile(filename, "binary", function(err, file) {
      if(err) {        
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.write(err + "\n");
        response.end();
        return;
      }

      var headers = {};
      var contentType = contentTypesByExtension[path.extname(filename)];
      if (contentType) headers["Content-Type"] = contentType;
      response.writeHead(200, headers);
      response.write(file, "binary");
      response.end();
    });
  });
}).listen(parseInt(port, 10));

console.log("Static file server running at\n  => http://localhost:" + port + "/\nCTRL + C to shutdown");


// Animation Parser
const TOTAL_LOOPS = '1e10';


let parseFrame = (frameString) => {
	return new Promise((resolve, reject)=> {
		var options = {ignoreComment: true, alwaysChildren: true, compact: false, alwaysArray: true};
		var result = convert.xml2js(frameString, options);
    	resolve(result)
	})
}

const getTotalFrames = async (page) => {
	const totalFrames = await page.evaluate(() => {
		return anim.totalFrames
	})
	return totalFrames;
}

const getFrameRate = async (page) => {
	const frameRate = await page.evaluate(() => {
		return anim.frameRate
	})
	return frameRate;
}

let getFrameData = async (page) => {
	let bodyHTML = await page.evaluate(() => {
		var container = document.getElementById('lottie')
		return container.innerHTML
	})
	return bodyHTML
}

let goToFrame = async (page, frame) => {
	let bodyHTML = await page.evaluate((frame) => {
		anim.goToAndStop(frame, true)
	}, frame)
}

const emptyContent = (node) => {
	return {
		$: node.$
	}
}

const getFrame = async (page) => {
	const bodyHTML = await getFrameData(page)
	const parsedFrame = await parseFrame(bodyHTML)
	return parsedFrame
}

const buildContainer = async (frameData) => {
	const container = {
		elements: [
			{
				type: frameData.elements[0].type,
				name: frameData.elements[0].name,
				attributes: {
					xmlns: frameData.elements[0].attributes.xmlns,
					height: frameData.elements[0].attributes.height,
					width: frameData.elements[0].attributes.width,
					preserveAspectRatio: frameData.elements[0].attributes.preserveAspectRatio,
					viewBox: frameData.elements[0].attributes.viewBox,
					style: frameData.elements[0].attributes.style,
				},
				elements: [{name:'style', type:'element', elements:[{type:'text', text:''}]}, ...frameData.elements[0].elements]
			}
		]
	}
	return container
}

const buildElementsData = (frameData) => {
	const elementsData = {}
	const iterateElements = (elements, parentElement) => {
		elements.forEach(element => {
			if(element.attributes) {
				let attributeKeys = Object.keys(element.attributes)
				let attributes = attributeKeys.reduce((accumulator, key)=>{
					accumulator[key] = {
						changed: false,
						values: []
					}
					return accumulator
				}, {})
				elementsData[element.attributes.__name] = {
					changed: false,
					attributes: attributes,
					node: element,
					parentNode: parentElement
				}
				if(element.elements) {
					iterateElements(element.elements, element)
				}
			}
		})
	}
	return new Promise((resolve, reject) => {
		//I am iterating the third element of the container which contains all the frames.
		// First element is the styles tag, second is defs and third is the group with the clipping url
		iterateElements(frameData.elements[0].elements, frameData.elements[0])
		resolve(elementsData)
	})

}

const traverseFrames = async (page, totalFrames) => {
	let currentFrame = 0
	let frames = []
	while(currentFrame < totalFrames) {
		await goToFrame(page, currentFrame)
		let parsedFrame = await getFrame(page)
		frames.push(parsedFrame.elements[0].elements)
		currentFrame += 1
	}
	return frames
}

const compareElements = async(elementsData, elements, index) => {
	const iterateElements = elements => {
		elements.forEach(element => {
			let name = element.attributes.__name
			if(name) {
				const elementData = elementsData[name]
				let attributes = element.attributes
				let keys = Object.keys(attributes)
				keys.forEach(key => {
					let exists = true
					if(!elementData.attributes[key]) {
						let attribute = {
							changed: false,
							values: []
						}
						let i = 0
						while(i <= index) {
							attribute.values.push('')
							i += 1
						}
						elementData.attributes[key] = attribute
						exists = false
					}
					let values = elementData.attributes[key].values
					let previousValue = values.length ? values[values.length - 1] : null

					// Setting first non-empty value as default value for element
					if(!elementData.node.attributes[key] && attributes[key] !== '') {
						elementData.node.attributes[key] = attributes[key]
					}
					if(previousValue !== null
					&& previousValue !== ''
					&& previousValue !== attributes[key]) {
						elementData.attributes[key].changed = true;
					}
					elementData.attributes[key].values.push(attributes[key])
				})
				if(element.elements) {
					iterateElements(element.elements)
				}
			}
		})
	}
	iterateElements(elements)
}

const includeFrames = async (elementsData, frames) => {
	
	frames.forEach((elements, index) => {
		compareElements(elementsData, elements, index)
	})
}

const formatKey = (key) => {
	if(key === 'style') {
		return 'visibility';
	}
	return key;
}

const buildKeyframes = (elementKey, changedAttributes) => {
	let keyframes = `@keyframes ${elementKey} {`
	keyframes += `\r\n`
	let properties = {}
	changedAttributes.forEach(attribute => {
		let values = attribute.values
		let attributeKey = attribute.key
		values.forEach((value, index) => {
			if(index > 0 && values[index - 1] === value && values[index + 1] === value) {
				// We are skipping
			} else {
				let percKey = Math.floor(index/(values.length-1) * 10000)
				if(!properties[percKey]) {
					properties[percKey] = {
						value: '',

					}
				}
				let currentProperty = properties[percKey];
				currentProperty.value += `${formatKey(attributeKey)}:${formatValue(attributeKey, value)};`
			}
		})
	})
	let percentKeys = Object.keys(properties).sort((a,b)=>a-b)
	percentKeys.forEach(key => {
		keyframes += `${key / 100}% {`
		keyframes += `${properties[key].value}`
		keyframes += '}'
		keyframes += `\r\n`
	})
	keyframes += '}'
	keyframes += `\r\n`
	return keyframes
}

const buildPaths = (values, elementName, animationDuration, stylesTextElement, extraAttributes) => {
	values = values.map((path, index)=>{
		return {
			path: path,
			index: index,
			lastIndex: index,
			canDelete: false,
			total: values.length
		}
	})

	let lastData
	values.forEach((data, index) => {
		if(lastData && data.path === lastData.path) {
			lastData.lastIndex = index
			data.canDelete = true
		} else {
			lastData = data
		}
	})
	values = values.filter((data)=>!data.canDelete)
	const paths = values.map((value, index) => {
		const pathName = elementName + '__' + index
		const animationValues = []
		let i = 0
		while (i < value.total) {
			if (i < value.index || i > value.lastIndex) {
				animationValues.push('hidden')
			} else {
				animationValues.push('inherit')
			}
			i += 1
		}

		const animationData = [{
			key: 'visibility',
			values: animationValues
		}]
		stylesTextElement.text += buildKeyframes(pathName, animationData)
		return {
			name: 'path',
			type: 'element',
			attributes: {
				d: formatValue('d--static', value.path),
				style: `animation: ${pathName} ${animationDuration}s steps(1) ${TOTAL_LOOPS};`,
				...extraAttributes
			}
		}
	})
	return paths
}

const createAnimations = async (elementsData, animationDuration, stylesTextElement) => {
	const keys = Object.keys(elementsData)
	keys.forEach(elementKey => {
		const elementData = elementsData[elementKey]
		const node = elementData.node
		const attributeKeys = Object.keys(elementData.attributes)
		let hasAnimation = false
		const changedAttributes = []
		const pathAttribute = []
		attributeKeys.forEach(attributeKey => {
			const attribute = elementData.attributes[attributeKey]
			if(attribute.changed) {
				// If targetting Chrome, this first condition is not needed because it supports css path values
				if (attributeKey === 'd' && false) {
					const parentNode = elementData.parentNode
					let extraAttributes = {}
					if(parentNode && parentNode.name === 'clipPath') {
						if(node.attributes['clip-rule'] && node.attributes['clip-rule'] !== 'nonzero') {
							extraAttributes['clip-rule'] = node.attributes['clip-rule']
						}
						parentNode.elements = buildPaths(attribute.values, elementKey, animationDuration, stylesTextElement, extraAttributes)
					} else {
						node.name = 'g'
						node.elements = buildPaths(attribute.values, elementKey, animationDuration, stylesTextElement, extraAttributes)
					}
				} else {
					changedAttributes.push({
						key: attributeKey,
						values: attribute.values
					})
					hasAnimation = true
				}
			}
		})
		if(hasAnimation) {
			let keyframes = buildKeyframes(elementKey, changedAttributes)
			stylesTextElement.text += keyframes
			changedAttributes.forEach(attribute => {
				node.attributes[attribute.key] = null
			})
			// node.attributes.style = `animation: ${elementKey} ${animationDuration}s steps(1) ${TOTAL_LOOPS};`
			// node.attributes.style += `animation-fill-mode: both;`
			// If we set animation properties as global, this is the only property that the animation needs:
			node.attributes.style = `animation-name: ${elementKey};`
		}
	})
	stylesTextElement.text += '\r\n'
	stylesTextElement.text += `*{animation-duration:${animationDuration}s;animation-timing-function:steps(1);animation-iteration-count: infinite;}`
}

const startAnimation = async(page) => {
	return new Promise(async (resolve, reject) => {

		await page.evaluate(() => {
			loadAnimation()
		})
		let intervalId = setInterval(async()=>{
			let isLoaded = await page.evaluate(() => {
				return isLoaded
			})
			if(isLoaded) {
				clearInterval(intervalId)
				resolve()
			}
		}, 100)
	})
}

const cleanUnneededAttributes = (elementsData) => {
	let elementsKeys = Object.keys(elementsData)
	elementsKeys.forEach(key => {
		let element = elementsData[key]
		let node = element.node
		let attributesKeys = Object.keys(node.attributes)
		attributesKeys.forEach(attributeKey => {
			if (attributeKey === '__name'
				|| attributeKey === 'style' && node.attributes[attributeKey] === 'display: block;'
				|| attributeKey === 'stroke-linejoin' && node.attributes[attributeKey] === 'miter'
				|| attributeKey === 'stroke-linecap' && node.attributes[attributeKey] === 'butt'
				|| attributeKey === 'opacity' && node.attributes[attributeKey] === '1'
				|| attributeKey === 'fill-opacity' && node.attributes[attributeKey] === '1'
				|| attributeKey === 'stroke-opacity' && node.attributes[attributeKey] === '1'
				) {
				node.attributes[attributeKey] = null;
			} else if (attributeKey === 'd' && node.attributes[attributeKey]) {
				node.attributes[attributeKey] = formatValue(attributeKey + '--static', node.attributes[attributeKey])
			} else if (attributeKey === 'transform' && node.attributes[attributeKey]) {
				node.attributes[attributeKey] = formatValue(attributeKey, node.attributes[attributeKey])
			} else if (attributeKey === 'style' && node.attributes[attributeKey] === 'display: none;') {
				node.name = null
				node.type = 'text'
				node.text = ''
			} else if (attributeKey === 'fill-opacity' && node.attributes[attributeKey] === '0') {
				node.attributes[attributeKey] = null
				node.attributes['fill'] = 'none'
			}
		})
	})
}

(async () => {
	try {
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.goto('http://localhost:8888/index.html', {waitUntil: 'networkidle2'});
		await startAnimation(page)
		const totalFrames = await getTotalFrames(page)
		const frameRate = await getFrameRate(page)
		const initialFrameData = await getFrame(page)
		const container = await buildContainer(initialFrameData)
		const elementsData = await buildElementsData(container)
		const frames = await traverseFrames(page, totalFrames)
		const content = await includeFrames(elementsData, frames)
		await createAnimations(elementsData, Math.ceil(1000 * frames.length / frameRate) / 1000, container.elements[0].elements[0].elements[0])
		await cleanUnneededAttributes(elementsData)
		var result = convert.js2xml(container, {});
		saveTemplate(result)
		// console.log(result)
		await browser.close();
	} catch(err) {
		console.log(err)
	}
})();