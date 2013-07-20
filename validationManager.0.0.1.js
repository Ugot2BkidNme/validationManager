/*! validationManager v0.0.1 Copyright (c) 2013 Ugot2BkidNme(Barry A. Rader) license: https://github.com/Ugot2BkidNme/validationManager/blob/master/license.txt */
Validator = function () {
  this.valid = true;
	this.name = null;
	this.event = "change";
	this.msgFail = "VM_StandardInvalid";
	this.msgPass = "VM_StandardValid";
	this.msgReplacements = {};
	this.condition = function () { return true; };
	this.validpattern = null;
	this.invalidpattern = null;
	this.trim = true;
	this.strippattern = null;
	this.minLength = null;
	this.minValue = null;
	this.maxLength = null;
	this.maxValue = null;
	this.validChars = "";
	this.invalidChars = "";
	this.success = function() { return; };
	this.fail = function() { return; };
	this.always = function() { return; };
	this.setState = function (target, summary) {
		var message = this.msgFail;
		if (this.valid) message = this.msgPass;
		VM.setState(target, this.valid, message, VM.clone(this.msgReplacements), summary);
		if (!target.suppressInlineFunctions) {
			if (this.state) this.success(target);
			else this.fail(target);
		}
		this.valid;
	};
	this.validate = function (target, value, summary) {
		this.valid = true;
		if (value === undefined) this.valid = false;
		if(!this.condition()) this.valid = false;
		if (this.trim) value = value.replace(/^\s+|\s+$/g,"");
		if (this.strippattern !== null) value = value.replace(this.strippattern,"");
		if (this.minLength !== null) {
			if (value.length < this.minLength) this.valid = false;
		}
		if (this.minValue !== null) {
			value = parseInt(value, 10);
			if (isNaN(value)) { this.valid = false; }
			if (value < this.minValue) { this.valid = false; }
		}
		if (this.maxLength !== null) {
			if (value.length > this.maxLength) { this.valid = false; }
		}
		if (this.maxValue !== null) {
			value = parseInt(value, 10);
			if (isNaN(value)) return this.valid = false;
			if (value > this.maxValue) this.valid = false;
		}
		if (this.validpattern !== null && !this.validpattern.test(value)) { this.valid = false; }
		if (this.invalidpattern !== null && this.invalidpattern.test(value)) { this.valid = false; }
		if (this.invalidChars.length > 0) {
			for (var i = 0, j = value.length; i < j; i++) {
				if (this.invalidChars.indexOf(value.charAt(i)) != -1) this.valid = false;
			}
		}
		this.setState(target, summary);
		if (!target.suppressInlineFunctions) this.always(target);
		return this.valid;
	};
};
VM = (function (window, document, $, contextManager, domBuilder, undefined) {
	var
		_version = "0.0.1"
		,_name = "ValidationManager"
		,_location = window.location
		,_whocalled = arguments.callee
		,_debug = false
		,_inline = false
		,_groupedSummary = true
		,_inlineOnSubmit = false
		,_errorSummaryDiv = "errorSummary"
		,_validationImageType = ".gif"
		,_validationImagePath = ""
		,_validationClassDislay = true
		,_validationImageDisplay = true
		,_validationMessageDisplay = true
		,_summaryHeaderMessage = "VM_StandardHeader"
		,_serverCode = ""
		,_serverMessage = ""
		,messageArray = []
		,validationGroups = {}
		,validators = {}
		//for debugging and passing messages we use console for older browsers this is not an option so supress it.
		,_console = (typeof window.console !== undefined) ? window.console: { log: function () {}, warn: function () {}, error: function () {} }
		//add our common functions used only by internal calls
		//write to console function
		,_wc = function (type, message, replacements) {
			if (!_debug && type === "log") return true;
			_console[type](contextManager.getContextString(message, replacements));
			if (type === "error") return false;
			return true;
		}
		//check for existance
		,_ce = function (object) {
			if (typeof object === "undefined") { return false; }
			return true;
		}
		//create the subobjects these are created exactly in this order for a reason
		,ValidationGroup = function () {
			return {
				fieldGroups: {}
				,name: ""
				,inline: false
				,groupedSummary: true
				,inlineOnSubmit: false
				,errorSummaryDiv: ""
				,summaryHeaderMessage: ""
				,submitId: ""
				,formId: ""
				,success: function() { return; }
				,fail: function() { return; }
				,always: function() { return; }
				,messageArray: []
				,valid: true
				,FieldGroup: function () {
					return {
						fields: {}
						,validators: {}
						,valid: true
						,name: ""
						,label: null
						,labelId: null
						,labelText: ""
						,msgFail: ""
						,msgPass: "VM_StandardValid"
						,inline: false
						,success: function() { return; }
						,fail: function() { return; }
						,always: function() { return; }
						,displayAfter: ""
						,type: "text"
						,eventType: "change"
						,suppressInlineFunctions: false
						,Field: function () {
							return {
								validators: {}
								,valid: true
								,label: null
								,labelText: ""
								,msgFail: ""
								,msgPass: "VM_StandardValid"
								,id: ""
								,inline: false
								,name: ""
								,displayAfter: ""
								,eventType: "change"
								,success: function() { return; }
								,fail: function() { return; }
								,always: function() { return; }
								,suppressInlineFunctions: false
							}
						}
					}
				}
			}
		}
		//add our methods
		,_initializeFormHandlers = function() {
			for (var validationGroupName in VM.validationGroups) {
				var
					vG = VM.validationGroups[validationGroupName]
					,vEvents = []
				;
				if (vG.formId !== "") {
					$("body").on("submit", "#" + vG.formId, {"validationGroupName": validationGroupName}, function(e) {
						e.preventDefault();
						if (typeof VM.validationGroups[e.data.validationGroupName] === "undefined") return true;
						if (VM.validateValidationGroup(e.data.validationGroupName)) return true;
						return false;
					});
				}
				for (var fieldGroupName in vG.fieldGroups) {
					var fG = vG.fieldGroups[fieldGroupName];
					for (var fieldId in fG.fields) {
						var
							f = fG.fields[fieldId]
							,curVs = []
							,curFGs = []
							,curVGs = []
						;
						if (_ce($("#"+f.id).attr("data-validators"))) curVs = $("#"+f.id).attr("data-validators").split(",");
						if (_ce($("#"+f.id).attr("data-fieldgroups"))) curFGs = $("#"+f.id).attr("data-fieldgroups").split(",");
						if (_ce($("#"+f.id).attr("data-validationgroups"))) curVGs = $("#"+f.id).attr("data-validationgroups").split(",");
						for (var validatorName in f.validators) {
							var v = f.validators[validatorName];
							//set validators
							if ($.inArray(v.name, curVs) === -1) curVs.push(v.name);
							if ($.inArray(v.event, vEvents) === -1) vEvents.push(v.event);
						}
						$("#"+f.id).attr("data-validators", curVs.join());
						//set fieldGroup
						if ($.inArray(fG.name, curFGs) === -1) curFGs.push(fG.name);
						$("#"+f.id).attr("data-fieldgroups", curFGs.join());
						//set validation Group
						if ($.inArray(vG.name, curVGs) === -1) curVGs.push(vG.name);
						$("#"+f.id).attr("data-validationgroups", curVGs.join());
					}
				}
			}
			_initializeFormElementHandlers(vEvents);
		}
		,_initializeFormElementHandlers = function(vEvents) {
			for (var vEvent in vEvents) {
				$("body").on(vEvents[vEvent], "[data-validators]", function(e) {
					var
						vGNames = $(this).attr("data-validationgroups").split(",");
						fGNames = $(this).attr("data-fieldgroups").split(",");
						fID = $(this).attr("id");
					;
					for (var vGName in vGNames) {
						if (typeof VM.validationGroups[vGNames[vGName]] !== "undefined") {
							var vG = VM.validationGroups[vGNames[vGName]];
							for (var fGName in fGNames) {
								if (typeof vG.fieldGroups[fGNames[fGName]] !== "undefined") {
									var fG = vG.fieldGroups[fGNames[fGName]];
									if (typeof fG.fields[fID] !== "undefined") VM.validateField(vG.name, fG.name, fID, false);
								}
							}
						}
					}
				});
			}
		}
		,_init = function () {
			_initializeFormHandlers();
		}
		,_addField = function (validationGroupName, fieldGroupName, properties) {
			if (!_ce(validationGroupName)) return _wc("error","VM_NoVariable", {variable:"validationGroupName", method:"addField", object: _name});
			if (!_ce(validationGroups[validationGroupName])) return _wc("error","VM_ObjectDoesNotExist", {variable:"validationGroup",name: validationGroupName ,method:"addField", object: _name});
			if (!_ce(fieldGroupName)) return _wc("error","VM_NoVariable", {variable:"fieldGroupName", method:"addField", object: _name});
			if (!_ce(properties.id)) return _wc("error","VM_NoVariable", {variable:"id", method:"addField", object: _name});
			//if name is not set we use the id for name
			if (!_ce(properties.name)) { properties.name = properties.id; }
			//if displayAfter is not set we use the id for displayAfter
			if (!_ce(properties.displayAfter)) { properties.displayAfter = properties.id; }
			//check if we have a field group name set if not use the fields name
			if (fieldGroupName === "") { fieldGroupName = properties.name; }
			if (!_ce(validationGroups[validationGroupName].fieldGroups[fieldGroupName])) {
				_addFieldGroup(validationGroupName, {name: fieldGroupName});
			}
			var
				vG = validationGroups[validationGroupName]
				,fG = vG.fieldGroups[fieldGroupName]
				,vs = null
			;
			//here we set the parent defaults if not set
			if (!_ce(properties.inline)) { properties.inline = fG.inline; }
			if (!_ce(properties.suppressInlineFunctions)) { properties.suppressInlineFunctions = fG.suppressInlineFunctions; }
			if (_ce(properties.validators)) {
				vs = properties.validators;
				delete properties.validators;
			}
			var f = new ValidationGroup().FieldGroup().Field();
			if (_ce(fG.fields[properties.id])) { f = fG.fields[properties.id]; }
			fG.fields[properties.id] = _mixin(f, properties);
			if (vs !== null) {
				for (var i = 0, j = vs.length; i < j; i++) {
					_addFieldValidator(validationGroupName, fieldGroupName, properties.id, vs[i]);
				}
			}
			return true;
		}
		,_addFieldValidator = function (validationGroupName, fieldGroupName, fieldId, properties) {
			if (!_ce(validationGroupName)) return _wc("error","VM_NoVariable", {variable:"validationGroupName", method:"addFieldValidator", object: _name});
			if (!_ce(fieldGroupName)) return _wc("error","VM_NoVariable", {variable:"fieldGroupName", method:"addFieldValidator", object: _name});
			if (!_ce(fieldId)) return _wc("error","VM_NoVariable", {variable:"fieldId", method:"addFieldValidator", object: _name});
			if (!_ce(properties.name)) return _wc("error","VM_NoVariable", {variable:"name", method:"addFieldValidator", object: _name});
			if (!_ce(validators[properties.name]))  return _wc("error","VM_ObjectDoesNotExist", {variable:"Validator",name: properties.name ,method:"addFieldValidator", object: _name});
			if (!_ce(validationGroups[validationGroupName]))  return _wc("error","VM_ObjectDoesNotExist", {variable:"ValidationGroup",name: validationGroupName ,method:"addFieldValidator", object: _name});
			var vG = validationGroups[validationGroupName];
			if (!_ce(vG.fieldGroups[fieldGroupName]))  return _wc("error","VM_ObjectDoesNotExist", {variable:"FieldGroup",name: fieldGroupName ,method:"addFieldValidator", object: _name});
			var fG = vG.fieldGroups[fieldGroupName];
			if (!_ce(fG.fields[fieldId]))  return _wc("error","VM_ObjectDoesNotExist", {variable:"Field",name: fieldId ,method:"addFieldValidator", object: _name});
			var
				f = fG.fields[fieldId]
				,v = _mixin(new Validator(), validators[properties.name])
			;
			if (_ce(f.validators[properties.name])) { v = f.validators[properties.name]; }
			f.validators[properties.name] = _mixin(v, properties);
			return true;
		}
		,_addFieldGroup = function (validationGroupName, properties) {
			if (!_ce(validationGroupName)) return _wc("error","VM_NoVariable", {variable:"validationGroupName", method:"addFieldGroup", object: _name});
			if (!_ce(validationGroups[validationGroupName]))  return _wc("error","VM_ObjectDoesNotExist", {variable:"ValidationGroup",name: validationGroupName ,method:"addFieldGroup", object: _name});
			if (!_ce(properties.name)) return _wc("error","VM_NoVariable", {variable:"name", method:"addFieldGroup", object: _name});
			//if displayAfter is not set we use the name for displayAfter
			if (!_ce(properties.displayAfter)) { properties.displayAfter = properties.name; }
			var
				vG = validationGroups[validationGroupName]
				,fs = null
				,vs = null
			;
			//here we set the parent defaults if not set
			if (!_ce(properties.inline)) { properties.inline = vG.inline; }
			//get the sub objects if present
			if (_ce(properties.fields)) {
				fs = properties.fields;
				delete properties.fields;
			}
			if (_ce(properties.validators)) {
				vs = properties.validators;
				delete properties.validators;
			}
			var fG = new ValidationGroup().FieldGroup();
			if (_ce(vG.fieldGroups[properties.name])) { fG = vG.fieldGroups[properties.name]; }
			vG.fieldGroups[properties.name] = _mixin(fG, properties);
			//deal with subobjects
			if (fs !== null) {
				for (var i = 0, j = fs.length; i < j; i++) {
					_addField(validationGroupName, properties.name, fs[i]);
				}
			}
			if (vs !== null) {
				for (var i = 0, j = vs.length; i < j; i++) {
					_addFieldGroupValidator(validationGroupName, properties.name, vs[i]);
				}
			}
			return true;
		}
		,_addFieldGroupValidator = function (validationGroupName, fieldGroupName, properties) {
			if (!_ce(validationGroupName)) return _wc("error","VM_NoVariable", {variable:"validationGroupName", method:"addFieldGroupValidator", object: _name});
			if (!_ce(fieldGroupName)) return _wc("error","VM_NoVariable", {variable:"fieldGroupName", method:"addFieldGroupValidator", object: _name});
			if (!_ce(properties.name)) return _wc("error","VM_NoVariable", {variable:"name", method:"addFieldGroupValidator", object: _name});
			if (!_ce(validationGroups[validationGroupName]))  return _wc("error","VM_ObjectDoesNotExist", {variable:"ValidationGroup", name: validationGroupName , method:"addFieldGroupValidator", object: _name});
			var vG = validationGroups[validationGroupName];
			if (!_ce(vG.fieldGroups[fieldGroupName]))  return _wc("error","VM_ObjectDoesNotExist", {variable:"FieldGroup",name: fieldGroupName ,method:"addFieldGroupValidator", object: _name});
			var
				fG = vG.fieldGroups[fieldGroupName]
				,v = _clone(validators[properties.name])
			;
			if (_ce(fG.validators[properties.name])) { v = fG.validators[properties.name]; }
			fG.validators[properties.name] = _mixin(v, properties);
			return true;
		}
		,_addValidationGroup = function (properties) {
			if (!_ce(properties.name)) return _wc("error","VM_NoVariable", {variable:"name",method:"addValidationGroup", object: _name});
			properties = properties || {};
			//here we set the parent defaults if not set
			if (!_ce(properties.inline)) { properties.inline = _inline; }
			if (!_ce(properties.groupedSummary)) { properties.groupedSummary = _groupedSummary; }
			if (!_ce(properties.inlineOnSubmit)) { properties.inlineOnSubmit = _inlineOnSubmit; }
			if (!_ce(properties.errorSummaryDiv)) { properties.errorSummaryDiv = _errorSummaryDiv; }
			if (!_ce(properties.summaryHeaderMessage)) { properties.summaryHeaderMessage = _summaryHeaderMessage; }
			var
				fs = null
				,fGs = null
			;
			//get the sub objects if present
			if (_ce(properties.fields)) {
				fs = properties.fields;
				delete properties.fields;
			}
			if (_ce(properties.fieldGroups)) {
				fGs = properties.fieldGroups;
				delete properties.fieldGroups;
			}
			validationGroups[properties.name] = _mixin(new ValidationGroup(), properties);
			//deal with subobjects
			if (fGs !== null) {
				for (var i = 0, j = fGs.length; i < j; i++) {
					_addFieldGroup(properties.name, fGs[i]);
				}
			}
			if (fs !== null) {
				for (var i = 0, j = fs.length; i < j; i++) {
					_addField(properties.name, "", fs[i]);
				}
			}
			return true;
		}
		,_addValidator = function (properties) {
			if (!_ce(properties.name)) return _wc("error","VM_NoVariable", {variable:"name", method:"addValidator", object: _name});
			validators[properties.name] = properties;
			return true;
		}
		,_getLabel = function(target) {
			if (target.label === null) {
				if (_ce(target.id)) {
					var curlabel = $("label[for='" + target.id + "']");
					if (curlabel.length == 0) {curlabel = $("#" + target.id).closest("label");}
					//if someone writes bad html or needs to point to another target follow naming convention
					if (curlabel.length == 0) {curlabel = $("#" + target.id + "Label");}
					target.label = curlabel;
				} else if (target.labelId !== null) {
					target.label = $("#" + target.labelId);
				}
			}
			return target.label;
		}
		,_getLabelText = function (target) {
			if (target.label === null) _getLabel(target);
			if (target.label !== null) if (target.label.length !== 0) target.labelText = $(target.label).html().replace(/<(.|\n)*?>/g,"").replace(/^\s+|\s+$/g,"");
			return target.labelText;
		}
		,_addInlineClass = function (target) {
			if (!_validationClassDislay) return true;
			var modifier = (target.valid) ? "valid" : "invalid";
			//determine if this is a fieldif not it is a fieldGroup
			if (_ce(target.id)) {
				$("#" + target.id).parent().addClass(modifier);
				$("#" + target.id).addClass(modifier);
			} else {
				$("#" + target.labelId).addClass(modifier);
				$("[name='" + target.name + "']").addClass(modifier);
			}
			//should return a jQuery obect
			if (_getLabel(target)) _getLabel(target).addClass(modifier);
			return true;
		}
		,_removeInlineClass = function (target) {
			if (!_validationClassDislay) return true;
			var modifier = (target.valid) ? "valid" : "invalid";
			//determine if this is a fieldif not it is a fieldGroup
			if (_ce(target.id)) {
				$("#" + target.id).parent().removeClass("valid").removeClass("invalid");
				$("#" + target.id).removeClass("valid").removeClass("invalid");
			} else {
				$("#" + target.labelId).removeClass("valid").removeClass("invalid");
				$("[name='" + target.name + "']").removeClass("valid").removeClass("invalid");
			}
			//should return a jQuery obect
			if (_getLabel(target)) _getLabel(target).removeClass("valid").removeClass("invalid");
			return true;
		}
		,_addInlineImage = function (target) {
			if (!_validationImageDisplay) return true;
			_removeInlineImage(target);
			var modifier = (target.valid) ? "valid" : "invalid";
			var identifier = target.id;
			if (_ce(identifier)) identifier = target.name;
			if (_ce(identifier)) {
				var img = domBuilder.img({
					"src": _validationImagePath + modifier + _validationImageType
					,"alt": contextManager.getContextString("VM_" + modifier)
					,"id": identifier + "_vmimage"
					,"class": "inlinevalidator"
					,"className": "inlinevalidator"
				});
				if (document.getElementById(target.displayAfter)) document.getElementById(target.displayAfter).parentNode.insertBefore(img, document.getElementById(target.displayAfter).nextSibling);
			}
			return true;
		}
		,_removeInlineImage = function (target) {
			var identifier = target.id;
			if (_ce(identifier)) identifier = target.name;
			if (document.getElementById(identifier + "_vmimage")) document.getElementById(identifier + "_vmimage").parentNode.removeChild(document.getElementById(identifier + "_vmimage"));
			return true;
		}
		,_addInlineMessage = function (target, message, replacements) {
			if (!_validationMessageDisplay) return true;
			if (message === "") return true;
			var identifier = target.id;
			if (_ce(identifier)) identifier = target.name;
			if (_ce(identifier)) {
				var div = domBuilder.div({
					"id": identifier + "_vmmessage"
					,"class": "inlinevalidator"
					,"contains": contextManager.getContextString(message, replacements)
				});
				if (document.getElementById(target.displayAfter)) document.getElementById(target.displayAfter).parentNode.insertBefore(div, document.getElementById(target.displayAfter).nextSibling);
			}
			return true;
		}
		,_removeInlineMessage = function (target) {
			var identifier = target.id;
			if (_ce(identifier)) identifier = target.name;
			if (document.getElementById(identifier + "_vmmessage")) document.getElementById(identifier + "_vmmessage").parentNode.removeChild(document.getElementById(identifier + "_vmmessage"));
			return true;
		}
		,_addInlineDisplay = function (target, message, replacements) {
			if (!target.inline) return true;
			_removeInlineMessage(target);
			message = message || "";
			replacements = (replacements !== undefined) ? replacements : {};
			_addInlineClass(target);
			_addInlineMessage(target, message, replacements);
			_addInlineImage(target);
			return true;
		}
		,_removeInlineDisplay = function (target) {
			_removeInlineClass(target);
			_removeInlineImage(target);
			_removeInlineMessage(target);
			return true;
		}
		,_addSummaryDisplay = function (target) {
			if (!target.groupedSummary) return true;
			if (!document.getElementById(target.errorSummaryDiv)) return _wc( "error", "VM_MissingInDOM", {variable:"errorSummaryDiv", value: target.errorSummaryDiv, method:"addSummaryDisplay", object: _name});
			if (target.messageArray.length > 0) {
				var
					header = domBuilder.p({contains: contextManager.getContextString(target.summaryHeaderMessage)})
					,errorMessageArea = document.getElementById(target.errorSummaryDiv)
				;
				errorMessageArea.appendChild(header);
				var errorList = domBuilder.ul();
				for (var i = 0, j = target.messageArray.length; i < j; i++) {
					var li = domBuilder.li({contains: target.messageArray[i]});
					errorList.appendChild(li);
				}
				errorMessageArea.appendChild(errorList);
				target.messageArray.length = 0;
				return false;
			}
			return true;
		}
		,_removeSummaryDisplay = function (target) {
			if (!document.getElementById(target.errorSummaryDiv)) return _wc( "error", "VM_MissingInDOM", {variable:"errorSummaryDiv", value: target.errorSummaryDiv, method:"removeSummaryDisplay", object: _name});
			var errorMessageArea = document.getElementById(target.errorSummaryDiv);
			errorMessageArea.innerHTML = "";
			return true;
		}
		,_removeAllSummaryDisplay = function () {
			for (var vG in validationGroups) {
				_removeSummaryDisplay(validationGroups[vG]);
			}
			return true;
		}
		,_removeAllInlineDisplay = function() {
			for (var validationGroupName in validationGroups) {
				var vG = validationGroups[validationGroupName];
				for (var fieldGroupName in vG.fieldGroups) {
					var fG = vG.fieldGroups[fieldGroupName];
					_removeInlineDisplay(fG);
					for (var fieldId in fG.fields) {
						var f = fG.fields[fieldId];
						_removeInlineDisplay(f);
					}
				}
			}
			return true;
		}
		,_value = function (target, val) {
			if (_ce(target.id)) {
				if (_ce(val)) $("#"+ target.id).val(val);
				val = $("#"+ target.id).val();
			} else {
				if ($("[name=" + target.name + "]").attr("type") === "radio") {
					//need to do something here not sure how yet if (_ce(val)) $("[name=" + name + "]").val() === val) .prop('checked', true);
					val =  $("[name=" + target.name + "]:checked").val();
				}
				val = $("[name=" + target.name + "]").val();
			}
			return val;
		}
		,_validateField = function (validationGroupName, fieldGroupName, fieldId, summary) {
			if (!_ce(validationGroupName)) return _wc("error","VM_NoVariable", {variable:"validationGroupName", method:"validateValidationGroup", object: _name});
			if (!_ce(validationGroups[validationGroupName])) return _wc("error","VM_ObjectDoesNotExist", {variable:"validationGroup",name: validationGroupName ,method:"validateField", object: _name});
			var vG = validationGroups[validationGroupName];
			if (!_ce(vG.fieldGroups[fieldGroupName])) return _wc("error","VM_ObjectDoesNotExist", {variable:"fieldGroup",name: fieldGroupName ,method:"validateField", object: _name});
			var fG = vG.fieldGroups[fieldGroupName];
			if (!_ce(fG.fields[fieldId])) return _wc("error","VM_ObjectDoesNotExist", {variable:"field",name: fieldId ,method:"validateField", object: _name});
			var f = fG.fields[fieldId];
			_removeInlineDisplay(f);
			f.validationGroupName = validationGroupName;
			f.fieldGroupName = fieldGroupName;
			f.valid = true;
			for (var fieldValidatorName in f.validators) {
				var vF = f.validators[fieldValidatorName];
				if(!vF.validate(f, _value(f), summary)) break;
			}
			if (!summary || f.suppressInlineFunctions) {
				if (!f.valid) {
					f.fail();
				} else {
					f.success();
				}
				f.always();
			}
			return f.valid;
		}
		,_validateFieldGroup = function (validationGroupName, fieldGroupName, summary) {
			if (!_ce(validationGroupName)) return _wc("error","VM_NoVariable", {variable:"validationGroupName", method:"validateValidationGroup", object: _name});
			if (!_ce(validationGroups[validationGroupName])) return _wc("error","VM_ObjectDoesNotExist", {variable:"validationGroup",name: validationGroupName ,method:"validateFieldGroup", object: _name});
			var vG = validationGroups[validationGroupName];
			if (!_ce(vG.fieldGroups[fieldGroupName])) return _wc("error","VM_ObjectDoesNotExist", {variable:"fieldGroup",name: fieldGroupName ,method:"validateFieldGroup", object: _name});
			var fG = vG.fieldGroups[fieldGroupName];
			_removeInlineDisplay(fG);
			fG.validationGroupName = validationGroupName;
			fG.valid = true;
			for (var fieldGroupValidatorName in fG.validators) {
				var vFG = fG.validators[fieldGroupValidatorName];
				if(!vFG.validate(fG, _value(fG), summary)) break;
			}
			for (var fieldId in fG.fields) {
				_validateField(validationGroupName, fieldGroupName, fieldId, summary);
			}
			if (!summary || fG.suppressInlineFunctions) {
				if (!fG.valid) {
					fG.fail();
				} else {
					fG.success();
				}
				fG.always();
			}
			return fG.valid;
		}
		,_validateValidationGroup = function (validationGroupName) {
			if (!_ce(validationGroupName)) return _wc("error","VM_NoVariable", {variable:"validationGroupName", method:"validateValidationGroup", object: _name});
			if (!_ce(validationGroups[validationGroupName])) return _wc("error","VM_ObjectDoesNotExist", {variable:"validationGroup",name: validationGroupName ,method:"validateValidationGroup", object: _name});
			var vG = validationGroups[validationGroupName];
			vG.messageArray.length = 0;
			_removeSummaryDisplay(vG);
			vG.valid = true;
			for (var fieldGroupName in vG.fieldGroups) {
				_validateFieldGroup(validationGroupName, fieldGroupName, true);
			}
			if (!vG.valid) {
				_addSummaryDisplay(vG);
				vG.fail();
			} else {
				vG.success();
			}
			vG.always();
			return vG.valid;
		}
		,_setState = function (target, state, message, replacements, summary) {
			target.valid = state;
			replacements = (_ce(replacements)) ? replacements : {};
			if (_ce(target.fields)) {
				if (!_ce(replacements.label)) replacements.label = _getLabelText(target);
				if (!state) {
					VM.validationGroups[target.validationGroupName].valid = state;
					if (VM.validationGroups[target.validationGroupName].groupedSummary) VM.validationGroups[target.validationGroupName].messageArray.push(contextManager.getContextString(message, replacements));
				}
			} else {
				if (!_ce(replacements.label)) replacements.label = _getLabelText(target);
				if (!state) {
					VM.validationGroups[target.validationGroupName].valid = state;
					VM.validationGroups[target.validationGroupName].fieldGroups[target.fieldGroupName].valid = state;
					if (VM.validationGroups[target.validationGroupName].groupedSummary) VM.validationGroups[target.validationGroupName].messageArray.push(contextManager.getContextString(message, replacements));
				}
				if (target.inline && (validationGroups[target.validationGroupName].inlineOnSubmit || !summary)) _addInlineDisplay(target, message, replacements);
			}
			return state
		}
		,_mixin = function (sourceobject, properties) {
			for (var i in properties){
				if (properties.hasOwnProperty(i)){
					sourceobject[i] = properties[i];
				}
			}
			return sourceobject;
		}
		,_clone = function (from, to) {
			if (from === null || typeof from !== "object") return from;
			if (from.constructor !== Object && from.constructor !== Array) return from;
			if (from.constructor === Date || from.constructor === RegExp || from.constructor === Function || from.constructor === String || from.constructor === Number || from.constructor === Boolean) return new from.constructor(from);
			to = to || new from.constructor();
			for (var name in from) {
				to[name] = (typeof to[name] == "undefined") ? _clone(from[name], null): to[name];
			}
			return to;
		}
		,_set = function (properties) {
			if (_ce(properties.debug)) _debug = properties.debug;
			if (_ce(properties.inline)) _inline = properties.inline;
			if (_ce(properties.groupedSummary)) _groupedSummary = properties.groupedSummary;
			if (_ce(properties.inlineOnSubmit)) _inlineOnSubmit = properties.inlineOnSubmit;
			if (_ce(properties.errorSummaryDiv)) _errorSummaryDiv = properties.errorSummaryDiv;
			if (_ce(properties.validationImageType)) _validationImageType = properties.validationImageType;
			if (_ce(properties.validationImagePath)) _validationImagePath = properties.validationImagePath;
			if (_ce(properties.validationClassDislay)) _validationClassDislay = properties.validationClassDislay;
			if (_ce(properties.validationImageDisplay)) _validationImageDisplay = properties.validationImageDisplay;
			if (_ce(properties.validationMessageDisplay)) _validationMessageDisplay = properties.validationMessageDisplay;
			if (_ce(properties.summaryHeaderMessage)) _summaryHeaderMessage = properties.summaryHeaderMessage;
			if (_ce(properties.serverCode)) _serverCode = properties.serverCode;
			if (_ce(properties.serverMessage)) _serverMessage = properties.serverMessage;
			return true;
		}
	;
	contextManager.add("en_US",{
		VM_NoVariable: "No {variable} was supplied, this is required for {method} of {object}"
		,VM_NoObject: "No {object} is found for {method} you must provide and {variable} for it to be created for you."
		,VM_ObjectDoesNotExist: "The object identified by {name} does not exist in the {object}."
		,VM_NoRegisteredValidator: "There is no validator registered by the name {value} in the current Validation Manager called by {method} in {object}"
		,VM_NoRegisteredValidationGroup: "There is no ValidationGroup registered by the name {value} in the current Validation Manager called by {method} in {object}"
		,VM_NoRegisteredFieldGroup: "There is no FieldGroup registered by the name {value} in the current Validation Manager called by {method} in {object}"
		,VM_NoRegisteredField: "There is no Field registered by the id {value} in the current Validation Manager called by {method} in {object}"
		,VM_valid: "valid"
		,VM_invalid: "invalid"
		,VM_NonNumeric: "The supplied value {value} for variable {variable} is not numeric for {method}"
		,VM_MissingInDOM: "The html object identified by the {variable} {value} for {method} is not present on the page"
		,VM_DebugDefault: "Entered {method} of {object} with {arguments}"
		,VM_ValidationApplied:"Validation applied."
		,VM_StandardHeader: "We are unable to complete your request, please fix the following errors to continue:"
		,VM_StandardRequired: "The field \u201C{label}\u201D is required."
		,VM_StandardInteger: "The field \u201C{label}\u201D only allows numeric characters."
		,VM_StandardSignedInteger: "The field \u201C{label}\u201D only allows numeric characters and optional preceeding "+" or "-" sign."
		,VM_StandardNumeric: "The field \u201C{label}\u201D only allows numeric characters with decimal places."
		,VM_StandardSignedNumeric: "The field \u201C{label}\u201D only allows numeric characters with decimal places and optional preceeding "+" or "-" sign."
		,VM_StandardInvalid: "Please enter a valid \u201C{label}\u201D."
		,VM_StandardInvalidRange: "The field \u201C{label}\u201D only accepts values between {minValue} and {maxValue}."
		,VM_StandardValid: ""
		,VM_NoPOBoxes: "P.O. boxes are not allowed in \u201C{label}\u201D."
	});
	return {
		version: _version
		,name: _name
		,debug: function(val) { if(_ce(val)) {_debug = val;} return _debug; }
		,inline: function(val) { if(_ce(val)) {_inline = val;} return _inline; }
		,groupedSummary: function(val) { if(_ce(val)) {_groupedSummary = val;} return _groupedSummary; }
		,inlineOnSubmit: function(val) { if(_ce(val)) {_inlineOnSubmit = val;} return _inlineOnSubmit; }
		,errorSummaryDiv: function(val) { if(_ce(val)) {_errorSummaryDiv = val;} return _errorSummaryDiv; }
		,validationImageType: function(val) { if(_ce(val)) {_validationImageType = val;} return _validationImageType; }
		,validationImagePath: function(val) { if(_ce(val)) {_validationImagePath = val;} return _validationImagePath; }
		,validationClassDislay: function(val) { if(_ce(val)) {_validationClassDislay = val;} return _validationClassDislay; }
		,validationImageDisplay: function(val) { if(_ce(val)) {_validationImageDisplay = val;} return _validationImageDisplay; }
		,validationMessageDisplay: function(val) { if(_ce(val)) {_validationMessageDisplay = val;} return _validationMessageDisplay; }
		,summaryHeaderMessage: function(val) { if(_ce(val)) {_summaryHeaderMessage = val;} return _summaryHeaderMessage; }
		,serverCode: function(val) { if(_ce(val)) {_serverCode = val;} return _serverCode; }
		,serverMessage: function(val) { if(_ce(val)) {_serverMessage = val;} return _serverMessage; }
		,validationGroups: validationGroups
		,validators: validators
		,set: _set
		,setState: _setState
		,initialize: _init
		,addValidationGroup: _addValidationGroup
		,addFieldGroup: _addFieldGroup
		,addFieldGroupValidator: _addFieldGroupValidator
		,addField: _addField
		,addFieldValidator: _addFieldValidator
		,validateValidationGroup: _validateValidationGroup
		,validateFieldGroup: _validateFieldGroup
		,validateField: _validateField
		,addValidator: _addValidator
		,clone: _clone
		,mixin: _mixin
	}
})(window, document, jQuery, contextManager, domBuilder);
VM.addValidator({name: "required", minLength: 1, msgFail: "VM_StandardRequired"});
VM.addValidator({name: "signedinteger", validpattern: /^(\+|-)?\d*$/, msgFail: "VM_StandardSignedInteger"});
VM.addValidator({name: "signednumeric", validpattern: /^(\+|-)?((\d*(\.\d*)?)|(\.\d*))\$/, strippattern: /,/g, msgFail: "VM_StandardSignedNumeric"});
VM.addValidator({name: "integer", validpattern: /^\d*$/, msgFail: "VM_StandardInteger"});
VM.addValidator({name: "numeric", validpattern: /^((\d*(\.\d*)?)|(\.\d*))$/, strippattern: /,/g, msgFail: "VM_StandardNumeric"});
VM.addValidator({name: "email", validpattern: /^(([a-z0-9]+_+)|([a-z0-9]+\-+)|([A-Za-z0-9]+\.+)|([a-z0-9]+\++))*[a-z0-9]+@((\w+\-+)|(\w+\.))*\w{1,63}\.[a-z]{2,6}$/i});
VM.addValidator({name: "naphone", validpattern: /^(((\+\d{1,3}(-| )?\(?\d\)?(-| )?\d{1,5})|(\(?\d{2,6}\)?))(-| )?(\d{3,4})(-| )?(\d{4})(( x| ext)(| )\d{1,5}){0,1}|na)$/i});
VM.addValidator({name: "usstateabbr", validpattern: /^(al|ak|as|az|ar|ca|co|ct|de|dc|fm|fl|ga|gu|hi|id|il|in|ia|ks|ky|la|me|mh|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|mp|oh|ok|or|pw|pa|pr|ri|sc|sd|tn|tx|ut|vt|vi|va|wa|wv|wi|wy)$/i});
VM.addValidator({name: "uszipcode", validpattern: /^\d{5}$|^\d{5}-\d{4}$/});
VM.addValidator({name: "caprovinceabbr", validpattern: /^(ab|bc|mb|nb|nl|nt|ns|nu|on|pe|qc|sk|yt)$/i});
VM.addValidator({name: "capostalcode", validpattern: /^[abceghj-nprstvxy]\d[a-z] *\d[a-z]\d$/i});
VM.addValidator({name: "ukpostcode", validpattern: /^[a-z]{1,2}\d[a-z\d]? *\d[abd-hjlnp-uw-z]{2}$/i});
VM.addValidator({name: "nopobox", invalidpattern: /(p((o|0)st(al)?|\.*|\s*)\s*((o|0)?(ffice)?)?\.*\s*b((o|0)x)?\.*\s*[0-9]+)/i, strippattern: /[^a-zA-Z0-9_\.\s]+/g, msgFail: "VM_NoPOBoxes"});
VM.addValidator({name: "ccwestern", validpattern: /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$/, strippattern: /[^0-9]+/});
VM.addValidator({name: "ccAmercianExpress", validpattern: /^3[47]\d{13}$/, strippattern: /[^0-9]+/});
VM.addValidator({name: "ccDiners", validpattern: /^3(?:0[0-5]|[68][0-9])[0-9]{11}$/, strippattern: /[^0-9]+/});
VM.addValidator({name: "ccDiscover", validpattern: /^6(?:011|5\d{2})\d{12}$/, strippattern: /[^0-9]+/});
VM.addValidator({name: "ccJCB", validpattern: /^(?:2131|1800|35\d{3})\d{11}$/, strippattern: /[^0-9]+/});
VM.addValidator({name: "ccMasterCard", validpattern: /^5[1-5]\d{14}$/, strippattern: /[^0-9]+/});
VM.addValidator({name: "ccVisa", validpattern: /^(4\d{12}(?:\d{3})?)$/, strippattern: /[^0-9]+/});
VM.addValidator({name: "numericMonth", minValue: 1, maxValue: 12, msgFail: "VM_StandardInvalidRange", msgReplacements:{minValue: 1, maxValue: 12}});
