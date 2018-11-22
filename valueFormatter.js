var rgbToHexa = require('./rgbToHexa');

const formatPath = (path) => {
	let pathParts = path.split(' ')
	simplifiedPaths = pathParts.map(path => {
		let parts = path.split(',')
		return parts.map(item=>{
			const parts = /([M|C])?([\-0-9.]+)(z)?/g.exec(item)
			if(!parts) {
				return item
			}
			let formattedItem = ''
			if(parts[1]) {
				formattedItem += parts[1]
			}
			if(parts[2]) {
				formattedItem += Math.ceil(Number(parts[2]) * 100) / 100
			}
			if(parts[3]) {
				formattedItem += parts[3]
			}
			return formattedItem

			//([M|C])?([\-0-9])+(z)?
		}).join(',')
	})
	return simplifiedPaths.join(' ')
}

const formatDashArray = (value) => {
	return value.split(' ').map(item=>Math.ceil(item*100)/100).join(' ')
}

const formatMatrix = (value) => {
	if(value) {
		let matrixNumbers = value.split(/\(|\)/)[1].split(',')
		let roundedValues = matrixNumbers.map(matrixNumber=>Math.ceil(matrixNumber*100)/100)
		let formattedValue = 'matrix(' + roundedValues.join(',') + ')'
		value = formattedValue
	} else {
		value = 'scale(1)'
	}
	return value
}

module.exports = function(type, value) {
	if (type === 'transform') {
		value = formatMatrix(value)
	} else if (type === 'style') {
		value = value === 'display: none;' ? 'hidden' : 'inherit';
	} else if (type === 'stroke-dasharray') {
		value = formatDashArray(value);
	} else if (type === 'opacity' 
		|| type === 'fill-opacity' 
		|| type === 'stroke-opacity' 
		|| type === 'stroke-width'
		|| type === 'stroke-dashoffset') {
		value = Math.ceil(value*100)/100;
	} else if (type === 'fill' || type === 'stroke') {
		if(value) {
			value = rgbToHexa(value);
		}
	} else if (type === 'd') {
		value = `path("${formatPath(value)}")`;
	} else if (type === 'd--static') {
		value = formatPath(value);
	}
	return value;
}