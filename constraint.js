var faker = require("faker");
faker.locale = "en";

var Constraint = function(properties)
{
	this.ident = properties.ident;
	this.expression = properties.expression;
	this.operator = properties.operator;
	this.value = properties.value;
	this.funcName = properties.funcName;
	// Supported kinds: "fileWithContent","fileExists"
	// integer, string, phoneNumber
	this.kind = properties.kind;
};

var returnConstraint = function(ident, value, funcName, kind, operator, expression) {
	var x = new Constraint(
		{
			ident: ident,
			value: value,
			funcName: funcName,
			kind: kind,
			operator : operator,
			expression: expression
		});
	return x;
};

var generateRandomString = function(begin, append) {
	var str = Math.random().toString(36).substring(7);
	if(begin)
		str = String.fromCharCode(begin) + str;
	return '\"'+str+'\"';
}

var generateBinaryExpConstraint = function(child, params, buf, funcName, operator) {

	var constraints=[];
	if( child.left.type == 'Identifier') {
		if(params.indexOf( child.left.name ) > -1) {
			// get expression from original source code:
			var expression = buf.substring(child.range[0], child.range[1]);
			var rightHand = buf.substring(child.right.range[0], child.right.range[1])

			var type = typeof(rightHand);
			if(! isNaN(rightHand))
				type = "integer";
			//console.log("genConstraint exp: "+expression+" right: "+rightHand+" type_right: "+type);

			var values=[];

			// if rightHand is undefined then operators do not matter
			if(rightHand == "undefined") {
				values.push("undefined");
				values.push(1);
			} else {
				if(operator=="==" || operator=="!=") {
					values.push(rightHand);
					if(type == "string"){
						values.push(generateRandomString());
					} else {
						values.push(rightHand+1);
					}
				} else if(operator=="<=" || operator=="<" || operator==">=" || operator==">"){
					if(type == "string"){
						var z = rightHand.charCodeAt(0);
						values.push(+generateRandomString(z+1));
						values.push(+generateRandomString(z-1));
					} else {
						values.push(parseFloat(rightHand)-1);
						values.push(parseFloat(rightHand)+1);
					}
				} else {
					//console.log("else operator "+operator);
				}
			}
			for(var i=0; i<values.length; ++i) {
				var x = returnConstraint(child.left.name, 
													values[i], 
													funcName, 
													type, 
													child.operator, 
													expression);
				constraints.push(x);
			}
		} else {
			//for( var p =0; p < params.length; p++ ) {
				if(operator == "==") {
				//var phNo = faker.phone.phoneNumber(faker.phone.phoneNumberFormat(0));
				//phNo = phNo.toString();
				var rightHand = buf.substring(child.right.range[0], child.right.range[1]).replace(/["']/g, "");
				//console.log('phoneNumber: '+phNo);
				//console.log('rightHand: '+rightHand);
				//phNo = phNo.replace(phNo.substring(0, 3), rightHand);
				constraints.push(returnConstraint(child.left.name, 
												rightHand, 
												funcName, 
												"nonFunctionParams", 
												child.operator, 
												expression));
				}
			//}
		}
	} else if(child.left.type == "CallExpression" &&
				child.left.callee && child.left.callee.property.name == "indexOf") {
		//console.log(JSON.stringify(child, null, 4));
		var innerValue = child.left.arguments[0].value;
		var constraints=[], values=[];
		values.push('\"'+innerValue+'\"');
		values.push(generateRandomString());
		for(var i=0; i<values.length; ++i) {
			var x = returnConstraint(child.left.callee.object.name, 
												values[i], 
												funcName, 
												type, 
												child.operator, 
												expression);
			constraints.push(x);
		}
	} //else if(child.type.identifier)
	return constraints;
};

var generateCallExpressionConstraint = function(child, params, funcName, property) {

	var constraints = [], expression;

	if( child.callee.property && property =="replace")
	{
		for( var p =0; p < params.length; p++ ) {
			constraints.push(returnConstraint(params[p], 
													"'1234567890'", 
													funcName, 
													"phoneNumber", 
													child.operator, 
													expression));
			constraints.push(returnConstraint(params[p], 
													"''", 
													funcName, 
													"phoneNumber", 
													child.operator, 
													expression));
		}
	}

	return constraints;
};

var generateOptions = function(isNull, norm_true) {
	var options;
	if(isNull)
		return options;

	options = {};
	if(arguments.length > 1) {
		options = {
			normalize : norm_true
		};
	}
	return JSON.stringify(options);
};

exports.Constraint = Constraint;
exports.generateBinExpConstraint = generateBinaryExpConstraint;
exports.generateCallExpConstraint = generateCallExpressionConstraint;
exports.generateOptions = generateOptions;