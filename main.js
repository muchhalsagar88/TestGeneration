var esprima = require("esprima");
var options = {tokens:true, tolerant: true, loc: true, range: true };
var faker = require("faker");
var fs = require("fs");
faker.locale = "en";
var mock = require('mock-fs');
var _ = require('underscore');
var Random = require('random-js');

var constraint = require("./constraint.js");
var qu = require("./queue.js");

function main()
{
	var args = process.argv.slice(2);

	if( args.length == 0 )
	{
		args = ["subject.js"];
	}
	var filePath = args[0];

	constraints(filePath);

	generateTestCases()

}

var engine = Random.engines.mt19937().autoSeed();

function createConcreteIntegerValue( greaterThan, constraintValue )
{
	if( greaterThan )
		return Random.integer(constraintValue,constraintValue+10)(engine);
	else
		return Random.integer(constraintValue-10,constraintValue)(engine);
}

function Constraint(properties)
{
	this.ident = properties.ident;
	this.expression = properties.expression;
	this.operator = properties.operator;
	this.value = properties.value;
	this.funcName = properties.funcName;
	// Supported kinds: "fileWithContent","fileExists"
	// integer, string, phoneNumber
	this.kind = properties.kind;
}

function fakeDemo()
{
	// console.log( faker.phone.phoneNumber() );
	// console.log( faker.phone.phoneNumberFormat() );
	// console.log( faker.phone.phoneFormats() );
}

var functionConstraints =
{
}

var mockFileLibrary = 
{
	pathExists:
	{
		//'path/fileExists': {}
	},
	fileWithContent:
	{
		pathContent: 
		{	
  			file1: 'text content',
		}
	}
};

var generateArgs = function(params) {

	var queue, oldQueue;
	//console.log("generateArgs: "+JSON.stringify(params, null, 4));
	for(var key in params) {
		if(oldQueue != null) {
			queue = new qu.Queue();
			while(! oldQueue.isEmpty()) {
				var elem = oldQueue.dequeue();
				var arr = params[key];
				if(arr.length == 0){
					queue.enqueue(elem+","+ "\""+faker.phone.phoneNumber(faker.phone.phoneNumberFormat(0))+"\"");
				} else {
					for(var i=0; i<arr.length; ++i){
						var temp = elem;
						temp = temp + ', '+arr[i];
						queue.enqueue(temp);
					}	
				}
			}
			oldQueue = queue;
		} else {
			oldQueue = new qu.Queue();
			if(params[key].length==0)
			{
				params[key].push("\""+faker.phone.phoneNumber(faker.phone.phoneNumberFormat(0))+"\"");
			}
			for(var i=0; i<params[key].length; ++i)
				oldQueue.enqueue(params[key][i]); 	
		}
	}
	// if(queue)
	// 	console.log(queue.getLength());
	// if(oldQueue)
	// 	console.log(oldQueue.getLength());
	if(queue == null)
		return oldQueue.asArray();
	return queue.asArray();
};

function generateTestCases()
{

	var content = "var subject = require('./subject.js')\nvar mock = require('mock-fs');\n";
	for ( var funcName in functionConstraints )
	{
		var params = {};

		// initialize params
		for (var i =0; i < functionConstraints[funcName].params.length; i++ )
		{
			var paramName = functionConstraints[funcName].params[i];
			//params[paramName] = '\'' + faker.phone.phoneNumber()+'\'';
			// console.log(paramName);
			params[paramName] = [];//'\'\'';
		}
		
		// update parameter values based on known constraints.
		var constraints = functionConstraints[funcName].constraints;
		// Handle global constraints...
		var fileWithContent = _.some(constraints, {kind: 'fileWithContent' });
		var pathExists      = _.some(constraints, {kind: 'fileExists' });

		//var booleanExists = _.some(constraints, {kind: 'boolean' });
		//console.log("booleanExists: "+booleanExists);
		var non_params = [];
		// plug-in values for parameters
		for( var c = 0; c < constraints.length; c++ )
		{
			var constraint = constraints[c];
			if( params.hasOwnProperty( constraint.ident ) )
			{
				params[constraint.ident].push(constraint.value);
			} else {
				non_params.push(c);
			}
		}

		for(var i=0;i<non_params.length;i++)
		{
			for (param in params)
			{
				if(params.hasOwnProperty(param))
				{
					var lst = params[param];
					var value = constraints[i].value;
					if(lst.length==0)
					{
						var phNo =faker.phone.phoneNumber(faker.phone.phoneNumberFormat(0));
						phNo =  "\"" + value + phNo.substring(3) + "\"";
						params[param].push("\""+faker.phone.phoneNumber(faker.phone.phoneNumberFormat(0))+"\"");
						//console.
					}
					else
					{
						var firstOne = lst[0];
						if(typeof(firstOne) == "string")
						{
							var phNo = faker.phone.phoneNumber(faker.phone.phoneNumberFormat(0));
							phNo = "\"" + value + phNo.substring(3) + "\"";
						}
						else
						{
							continue;
						}
					}

					params[param].push(phNo);

				}
			}
		}

		var args = generateArgs(params);
		if(args.length == 0) {
			console.log("NO ARGS");
			for(var i =0; i<params.length; ++i) {

			}
		}
		//console.log("args:\n"+args);

		if( pathExists || fileWithContent )
		{
			//console.log(JSON.stringify(args, null, 4));
			for(var i=0; i< args.length; ++i) {
				//console.log(args[i]);
				content += generateMockFsTestCases(pathExists,fileWithContent,funcName, args[i]);
				// Bonus...generate constraint variations test cases....
				content += generateMockFsTestCases(!pathExists,fileWithContent,funcName, args[i]);
				content += generateMockFsTestCases(pathExists,!fileWithContent,funcName, args[i]);
				content += generateMockFsTestCases(!pathExists,!fileWithContent,funcName, args[i]);
			}
		} 
		else
		{
			// Emit simple test case.
			for(var i=0; i< args.length; ++i)
				content += "subject.{0}({1});\n".format(funcName, args[i] );
		}

	}


	fs.writeFileSync('test.js', content, "utf8");

}

var getPhoneString = function(number, count) {

	var str = '"'+number+'"';
	for(var x=0; x<count-1; x++){
		str = str + ', ' + '"'+number+'"';
	}
	return str;
} 

function generateMockFsTestCases (pathExists,fileWithContent,funcName,args) 
{
	var testCase = "";

	//console.log(JSON.stringify(args, null, 4));
	// Build mock file system based on constraints.
	var mergedFS = {};
	if( pathExists )
	{
		for (var attrname in mockFileLibrary.pathExists) { mergedFS[attrname] = mockFileLibrary.pathExists[attrname]; }
	}
	if( fileWithContent )
	{
		for (var attrname in mockFileLibrary.fileWithContent) { mergedFS[attrname] = mockFileLibrary.fileWithContent[attrname]; }
	}
	testCase += 
	"mock(" +
		JSON.stringify(mergedFS)
		+
	");\n";
	
	testCase += "\tsubject.{0}({1});\n".format(funcName, args );
	testCase+="mock.restore();\n";
	return testCase;
}

function constraints(filePath)
{
   var buf = fs.readFileSync(filePath, "utf8");
	var result = esprima.parse(buf, options);
	var expression;

	traverse(result, function (node) 
	{
		if (node.type === 'FunctionDeclaration') 
		{
			var funcName = functionName(node);
			// console.log("Line : {0} Function: {1}".format(node.loc.start.line, funcName ));

			var params = node.params.map(function(p) {return p.name});

			functionConstraints[funcName] = {constraints:[], params: params};

			// Check for expressions using argument.
			traverse(node, function(child)
			{
				if( child.type === 'BinaryExpression')
				{
					Array.prototype.push.apply(functionConstraints[funcName].constraints,  
						constraint.generateBinExpConstraint(child, params, buf, funcName, child.operator));
				}

				if( child.type == "CallExpression" && 
					 child.callee.property &&
					 child.callee.property.name =="readFileSync" )
				{
					for( var p =0; p < params.length; p++ )
					{
						// console.log("inside readFileSync: child.name: "+child.arguments[0].name+" params[p]: "+params[p]);
						if( child.arguments[0].name == params[p] )
						{
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								value: "'pathContent/file1'",
								funcName: funcName,
								kind: "fileWithContent",
								operator : child.operator,
								expression: expression
							}));
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								value: "'pathContent/fileNoContent'",
								funcName: funcName,
								kind: "fileWithContent",
								operator : child.operator,
								expression: expression
							}));
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								value: "'pathContent/fileNotExists'",
								funcName: funcName,
								kind: "fileWithContent",
								operator : child.operator,
								expression: expression
							}));
						}
					}
					mockFileLibrary.fileWithContent.pathContent.file1 = 'text content';
					mockFileLibrary.fileWithContent.pathContent.fileNoContent = '';
				}

				if( child.type == "CallExpression" &&
					 child.callee.property &&
					 child.callee.property.name =="existsSync")
				{
					for( var p =0; p < params.length; p++ )
					{
						// console.log("inside existsSync: child.name: "+child.arguments[0].name+" params[p]: "+params[p]);
						if( child.arguments[0].name == params[p] )
						{
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[0],
								// A fake path to a file
								value: "'path'",
								funcName: funcName,
								kind: "fileExists",
								operator : child.operator,
								expression: expression
							}));
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[0],
								// A fake path to a file
								value: "'pathContent'",
								funcName: funcName,
								kind: "fileExists",
								operator : child.operator,
								expression: expression
							}));
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[0],
								// A fake path to a file
								value: "'wrong_path'",
								funcName: funcName,
								kind: "fileExists",
								operator : child.operator,
								expression: expression
							}));
						}
					}
					//mockFileLibrary.pathExists['pathContent/fileExists'] = {};
					mockFileLibrary.pathExists['path'] = {};
				}

				if(child.type == "UnaryExpression" && child.argument && child.argument.property
					&& child.argument.property.type =="Identifier") {
					console.log("SAGAR        MUCHHAL");
					var propertyName = child.argument.property.name;
					var obj1 = {};
					var obj2 = {}; 
					obj2[propertyName] = true;
					var obj3 = {}; 
					obj3[propertyName] = false;
					
					functionConstraints[funcName].constraints.push(
							new Constraint(
							{
								ident: child.argument.object.name,
								value: JSON.stringify(obj3),
								funcName: funcName,
								kind: "object",
								operator : child.operator,
								expression: expression
							})
						);
					functionConstraints[funcName].constraints.push(
							new Constraint(
							{
								ident: child.argument.object.name,
								value: JSON.stringify(obj2),
								funcName: funcName,
								kind: "object",
								operator : child.operator,
								expression: expression
							})
						);
					functionConstraints[funcName].constraints.push(
							new Constraint(
							{
								ident: child.argument.object.name,
								value: JSON.stringify(obj1),
								funcName: funcName,
								kind: "object",
								operator : child.operator,
								expression: expression
							})
						);
				}

				/*if( child.type == "CallExpression" && child.callee.property &&
					 child.callee.property.name =="replace") {

					for( var p =0; p < params.length; p++ ) {
						
						functionConstraints[funcName].constraints.push(
							new Constraint(
							{
								ident: params[p],
								value: "'"+faker.phone.phoneNumber(faker.phone.phoneNumberFormat(0))+"'",
								funcName: funcName,
								kind: "phoneNumber",
								operator : child.operator,
								expression: expression
							})
						);
					}
				}*/
			});
			
			// console.log( functionConstraints[funcName]);
		}
	});
}

function traverse(object, visitor) 
{
    var key, child;

    visitor.call(null, object);
    for (key in object) {
        if (object.hasOwnProperty(key)) {
            child = object[key];
            if (typeof child === 'object' && child !== null) {
                traverse(child, visitor);
            }
        }
    }
}

function traverseWithCancel(object, visitor)
{
    var key, child;

    if( visitor.call(null, object) )
    {
	    for (key in object) {
	        if (object.hasOwnProperty(key)) {
	            child = object[key];
	            if (typeof child === 'object' && child !== null) {
	                traverseWithCancel(child, visitor);
	            }
	        }
	    }
 	 }
}

function functionName( node )
{
	if( node.id )
	{
		return node.id.name;
	}
	return "";
}


if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

main();
