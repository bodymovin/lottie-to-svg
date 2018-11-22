var rgbToHex = function (rgb) { 
  var hex = Number(rgb).toString(16);
  if (hex.length < 2) {
       hex = "0" + hex;
  }
  return hex;
};

var fullColorHex = function(r,g,b) {   
  var red = rgbToHex(r);
  var green = rgbToHex(g);
  var blue = rgbToHex(b);
  return '#'+red+green+blue;
};

module.exports = function(rgbString) {
	let colors = rgbString.split(/\(|\)/)[1].split(',')
	return fullColorHex(colors[0], colors[1], colors[2])
}