var fs = require("fs")

let saveTemplate = (svgData) => {
	let template = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <style>
        body, html{
            background-color:#ccc;
            margin: 0px;
            height: 100%;
            overflow-x: hidden;
            overflow-y: auto;
        }

        #lottie{
            background-color:#ccc;
            width:100%;
            height:100%;
            display:block;
            overflow: hidden;
            transform: translate3d(0,0,0);
            /*display:none;*/
        }

    </style>
    <script src="lottie.js"></script>

</head>
<body>
<div id="lottie">
	${svgData}
</div>
</body>
</html>`
fs.writeFile('pages/test.html', template, function(err, data){
    if (err) console.log(err);
    console.log("Successfully Written HTML File.");
});
fs.writeFile('pages/anim.svg', svgData, function(err, data){
    if (err) console.log(err);
    console.log("Successfully Written SVG File.");
});
}


module.exports = saveTemplate