// Copyright 2011 Google Inc. All Rights Reserved.
//
// Use of this source code is governed by a BSD-type license.
// See the COPYING file for details.

/**
 * Experimental CSS (ExCSS).
 *
 * Supports mixins with arguments, nested selectors, and variables with a
 * dynamic js API.
 *
 * Include as either
 *
 *   <style type="text/excss">
 *     ...
 *   </style>
 *
 * or
 *
 *   <link href="style.excss" type="text/excss"> (requires XHR)
 *
 * Followed by inclusion of this script.
 *
 * Use the js variables API with
 *
 *   CSS.setVariable('myVariable', '#f00');
 *
 * Author: Benjamin Kalman <kalman@chromium.org>
 */

// TODO: gracefully deal with errors rather than printing nothing.
// TODO: pretty-print parts not related to rulesets (block? etc).
// TODO: Expression FIXME as described in the code somewhere.

(function(window) {
'use strict';

var document = window.document;
var exports = window.exports;
var console = window.console;

var isDebug = false;
var isInstrumented = false;

if (document) {
  var allScripts = document.getElementsByTagName('script');
  var thisScript = allScripts[allScripts.length - 1];
  if (thisScript.getAttribute('debug') === 'true') {
    isDebug = true;
  }
  if (thisScript.getAttribute('instrumented') === 'true') {
    isInstrumented = true;
  }
}

function alwaysLog(s) {
  if (console) {
    alwaysLog = function(s) {
      console.log('EXCSS: ' + s);
    };
    alwaysLog(s);
  }
}

function neverLog(s) {
}

function log(s) {
  log = isDebug ? alwaysLog : neverLog;
}

function warn(s) {
  if (console) {
    warn = function(s) {
      console.warn('EXCSS WARNING: ' + s);
    };
    warn(s);
  } else {
    warn = neverLog;
  }
}

function error(s) {
  if (console) {
    error = function(s) {
      console.error('EXCSS ERROR: ' + s);
    };
    error(s);
  } else {
    error = neverLog;
  }
}

function instrument(description, action) {
  var start, returnValue, elapsed;
  if (isInstrumented) {
    start = new Date().getTime();
  }
  returnValue = action();
  if (isInstrumented) {
    elapsed = new Date().getTime() - start;
    alwaysLog('INSTRUMENTATION: ' + description + ' took ' + elapsed + 'ms');
  }
  return returnValue;
}

Object.keys = Object.keys || function(object) {
  var key, keys = [];
  for (key in object) {
    if (object.hasOwnProperty(key)) {
      keys.push(key);
    }
  }
  return keys;
};

////////////////////////////////////////////////////////////////////////
// CSS PARSER
////////////////////////////////////////////////////////////////////////

function Token(value, remainder, type) {
  this.value = value;
  this.remainder = remainder;
  this.type = type;
}

//
// Combinators.
//
// These functions return a function from string to Token -- that is, the
// contents of a match (whether it be a string, array, etc), the remaining
// string, and maybe the type of the token.
//
// In most cases the combinators actually take a variable number of such
// functions, combining them (hence the terms combinators) to make a more
// complex parse function.  These are the building blocks for the CSS parser.
//

// Returns a parse function derived from a given primitive; either a string,
// regexp, array, or an object that is assumed to already be a parse function.
function rule(something) {
  if (typeof(something) === 'string') {
    return function(s) {
      return s.indexOf(something.toLowerCase()) === 0 ?
          new Token(something, s.slice(something.length)) : undefined;
    };
  } else if (something instanceof RegExp) {
    return function(s) {
      var asString = something.toString().match(/^\/([^\/]*)\/[^\/]*$/)[1];
      var match = s.match(new RegExp('^(' + asString + ')', 'i'));
      if (!match) {
        return undefined;
      }
      var matchString = match[0];
      return new Token(matchString, s.slice(matchString.length));
    };
  } else if (something instanceof Array) {
    return all.apply(undefined, something);
  } else if (something instanceof Function) {
    // Presumably it's a rule (i.e. a function of string to token).
    return something;
  } else {
    throw new Error('Unknown argument to rule: ' + something);
  }
}

// Returns a parse function derived from a chain of given parse functions.
// The returned function will return undefined if any function in the chain
// returns undefined, otherwise it returns (as its Token result) the list of all
// results.
//
// E.g. all('foo', 'bar')('foobarbaz') -> Token(['foo', 'bar'], 'baz').
//      all('bar', 'foo')('foobarbaz') -> undefined
function all() {
  var parseFunctions = arguments;
  return function(s) {
    var results = [];
    var remainder = s;
    for (var i = 0; i < parseFunctions.length; i++) {
      var thisResult = rule(parseFunctions[i])(remainder);
      if (!thisResult) {
        return undefined;
      }
      results.push(thisResult);
      remainder = thisResult.remainder;
    }
    return new Token(results, remainder);
  };
}

// Returns a parse function which returns the first Token returned by a list of
// parse functions.
//
// E.g. first('foo', 'bar', 'baz')('barbazfoo') -> Token('bar', 'bazfoo').
function first() {
  var parseFunctions = arguments;
  return function(s) {
    for (var i = 0; i < parseFunctions.length; i++) {
      var consumed = rule(parseFunctions[i])(s);
      if (consumed) {
        return new Token(consumed, consumed.remainder);
      }
    }
    return undefined;
  };
}

// Returns a parse function which always returns undefined.
function nothing() {
  return function(s) {
    return undefined;
  };
}

// Like all, but returns an empty Token (as opposed to undefined) if any
// functions don't parse.
//
// E.g. zeroOrOne('foo', 'bar')('foobarbaz') -> Token(['foo', 'bar'], 'baz')
//      zeroOrOne('foo', 'baz')('foobarbaz') -> Token('', 'foobarbaz')
function zeroOrOne() {
  var parseFunctions = arguments;
  return function(s) {
    var result = all.apply(undefined, parseFunctions)(s);
    return result ? result : new Token('', s);
  };
}

// Like all, but keeps on matching the entire chain until it no longer matches.
// Returns undefined unless there is at least one match.
//
// E.g. oneOrMore('foo', 'bar')('foobarfoobarbaz')
//          -> Token([['foo', 'bar'], ['foo', 'bar']], 'baz')
//      oneOrMore('foo', 'bar')('baz') -> undefined
function oneOrMore() {
  var parseFunctions = arguments;
  return function(s) {
    var results = [];
    var remainder = s;
    var currentResult;
    while (true) {
      var thisResult = all.apply(undefined, parseFunctions)(remainder);
      if (!thisResult) {
        return currentResult;
      }
      results.push(thisResult);
      remainder = thisResult.remainder;
      currentResult = new Token(results, remainder, thisResult.type);
    }
  };
}

// Like oneOrMore, but returns an empty Token rather than undefined if the chain
// doesn't match.
//
// E.g. zeroOrMore('foo', 'bar')('foobarfoobarbaz')
//          -> Token([['foo', 'bar'], ['foo', 'bar']], 'baz')
//      zeroOrMore('foo', 'bar')('baz') -> Token('', 'baz')
function zeroOrMore() {
  return zeroOrOne(oneOrMore.apply(undefined, arguments));
}

// Returns a function which attaches a type to the result of a parse function.
function withType(type, parseFunction) {
  return function(s) {
    var result = parseFunction(s);
    if (!result) {
      return undefined;
    }
    result.type = type;
    return result;
  };
}

//
// Delayed lookup functions.
//
// These exist so that the result of looking up a macro/token/grammar rule is
// actually a parse function that returns the result, rather than the result
// itself.  This is for the combinators to behave correctly.
//

var TABLES = {};

function lookup(tableName, key) {
  return function(string) {
    var table = TABLES[tableName];
    if (!table) {
      throw new Error('Can\'t find table ' + tableName);
    }
    var value = table[key] ? table[key] : table[key + '_'];
    if (!value) {
      throw new Error('Can\'t find token for key ' + key + ' in ' + tableName);
    }
    return value(string);
  };
}

function m(key) {
  return lookup('Macros', key);
}

function t(key) {
  var table = (key.indexOf('EXCSS_') === 0) ? 'ExCssTokens' : 'Tokens';
  return lookup(table, key);
}

var SS = t('SS');

function g(key) {
  return lookup('Grammar', key);
}

// Maps all combinators to rules which produce them.
function ruleify(combinators) {
  Object.keys(combinators).forEach(function(type) {
    combinators[type] = rule(combinators[type]);
  });
  return combinators;
};

// Decorates all combinators with their type derived from the key.
function typeify(combinators) {
  Object.keys(combinators).forEach(function(type) {
    combinators[type] = withType(type, combinators[type]);
  });
  return combinators;
}

// Macros as defined in the CSS2 spec, for convenience.
TABLES.Macros = ruleify({
  ident: [zeroOrOne('-'), m('nmstart'), zeroOrMore(m('nmchar'))],
  name: oneOrMore(m('nmchar')),
  nmstart: first(/[_a-z]/, m('nonascii'), m('escape')),
  // TODO: implement nonascii.
  nonascii: nothing(),
  unicode: [/\\[0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?/],
  escape_: first(m('unicode'), ['\\', /"[^\n\r\f0-9a-f]"/]),
  nmchar: first(/[_a-z0-9\-]/, m('nonascii'), m('escape')),
  // NOTE: in the CSS3 grammar, num is /[0-9]+|[0-9]*\.[0-9]+/.
  // Modified here to allow for negative numbers, and for parser correctness.
  num: [/[-]?([0-9]*\.[0-9]+|[0-9]+)/],
  string: first(m('string1'), m('string2')),
  string1:
    ['"', zeroOrMore(first(/[^\n\r\f"]/, ['\\', m('nl')], m('escape'))), '"'],
  string2:
    ["'", zeroOrMore(first(/[^\n\r\f']/, ['\\', m('nl')], m('escape'))), "'"],
  invalid: first(m('invalid1'), m('invalid2')),
  invalid1:
    ['"', zeroOrMore(first(/[^\n\r\f\"]/, ['\\', m('nl')], m('escape')))],
  invalid2:
    ["'", zeroOrMore(first(/[^\n\r\f\"]/, ['\\', m('nl')], m('escape')))],
  nl: /\n|\r\n|\r|\f/,
  w: /[ \t\r\n\f]*/
});

// Matches (almost) the Tokens defined in the CSS2 spec.
TABLES.Tokens = ruleify({
  IDENT: m('ident'),
  ATKEYWORD: ['@', m('ident')],
  STRING: m('string'),
  INVALID: m('invalid'),
  HASH: ['#', m('name')],
  NUMBER: m('num'),
  PERCENTAGE: [m('num'), '%'],
  DIMENSION: [m('num'), m('ident')],
  URI: first(['url(', m('w'), m('string'), m('w'), ')'],
             ['url(',
              m('w'),
              zeroOrMore(first(/[!#$%&*-~]/, m('nonascii'), m('escape'))),
              m('w'),
              ')']),
  // TODO: implement UNICODE_RANGE.
  UNICODE_RANGE: nothing(),
  CDO: '<!--',
  CDC: '-->',
  S: /[ \t\r\n\f]+/,
  // NOTE: SS is not a core token, but it's a convenient replacement for S*
  // which appears everywhere.  Just use the SS constant for this.
  SS: /[ \t\r\n\f]*/,
  FUNCTION_: [m('ident'), '('],
  INCLUDES: '~=',
  DASHMATCH: '|=',
  DELIM: /[^@#% :;{}()\[\]\t\r\n\f'"]/,
  NOTBRACE: /[^{}]/
});

// Extra tokens added for ExCSS.  These should all start with "EXCSS_".
TABLES.ExCssTokens = ruleify({
  EXCSS_VARIABLE_IDENT: ['$', m('ident')]
});

// Grammar, based off the grammar in the CSS2 spec.
//
// stylesheet       : [ S | statement ]*;
// statement        : var-decl | trait | ruleset;
// var-decl         : '@var' S* var-ident S* var-init ';'+;
// var-ident        : IDENT;
// var-init         : values;
// trait            : '@trait' S* trait-ident S* [ trait-params S* ]? rulebody
// trait-ident      : IDENT;
// trait-params     : '(' S* trait-param [ ',' S* trait-param ]* ')';
// trait-param      : IDENT;
// rulebody         : '{' S* [ ruleitem S* ]* [ ruleitem-single S* ]? '}';
// ruleitem         : nested | [ mixin ';' ] | [ declaration ';' ] ';'*;
// ruleitem-single  : nested | mixin | declaration;
// nested           : nested-selector rulebody;
// nested-selector  : nested-decl selector;
// nested-decl      : '&';
// selector         : NOTBRACE*;
// mixin            : '@mixin' S* [ mixin-value S* ]+;
// mixin-value      : mixin-ident S* mixin-args?;
// mixin-ident      : IDENT;
// mixin-args       : '(' S* mixin-arg [ ',' S* mixin-arg ]* ')';
// mixin-arg        : value;
// declaration      : property S* ':' S* values;
// property         : IDENT;
// ruleset          : selector rulebody;
// values           : value+;
// value            : [ FUNCTION S* value*
//                    | ATKEYWORD
//                    | IDENT
//                    | EXCSS_VARABLE_IDENT
//                    | PERCENTAGE
//                    | DIMENSION
//                    | NUMBER
//                    | STRING
//                    | DELIM
//                    | URI
//                    | HASH
//                    | UNICODE-RANGE
//                    | INCLUDES
//                    | DASHMATCH
//                    | ':'
//                    | '(' S* value* ')'
//                    | '[' S* value* ']'
//                    ] S*;
TABLES.Grammar = typeify(ruleify({
  stylesheet: zeroOrMore(first(t('S'), g('statement'))),
  statement: first(g('var_decl'), g('trait'), g('ruleset')),
  var_decl: ['@var', SS, g('var_ident'), SS, g('var_init'), oneOrMore(';')],
  var_ident: t('IDENT'),
  var_init: g('values'),
  trait: ['@trait',
          SS,
          g('trait_ident'),
          SS,
          zeroOrOne(g('trait_params'), SS),
          g('rulebody')],
  trait_ident: t('IDENT'),
  trait_params:
    ['(', SS, g('trait_param'), zeroOrMore(',', SS, g('trait_param')), ')'],
  trait_param: t('IDENT'),
  rulebody: ['{',
             SS,
             zeroOrMore(g('ruleitem'), SS),
             zeroOrOne(g('ruleitem_single'), SS),
             '}'],
  ruleitem: [first(g('nested'), [g('mixin'), ';'], [g('declaration'), ';']),
             zeroOrMore(';')],
  ruleitem_single: first(g('nested'), g('mixin'), g('declaration')),
  nested: [g('nested_selector'), g('selector'), g('rulebody')],
  nested_selector: [g('nested_decl'), g('selector')],
  nested_decl: '&',
  selector: zeroOrMore(t('NOTBRACE')),
  mixin: ['@mixin', SS, oneOrMore(g('mixin_value'), SS)],
  mixin_value: [g('mixin_ident'), SS, zeroOrOne(g('mixin_args'))],
  mixin_ident: t('IDENT'),
  mixin_args:
    ['(', SS, g('mixin_arg'), zeroOrMore(',', SS, g('mixin_arg')), ')'],
  mixin_arg: g('value'),
  declaration: [g('property'), SS, ':', SS, g('values')],
  property: t('IDENT'),
  ruleset: [g('selector'), g('rulebody')],
  values: oneOrMore(g('value')),
  value: [first([t('FUNCTION'), SS, zeroOrMore(g('value')), ')'],
                t('IDENT'),
                t('EXCSS_VARIABLE_IDENT'),
                t('PERCENTAGE'),
                t('DIMENSION'),
                t('NUMBER'),
                t('STRING'),
                t('DELIM'),
                t('URI'),
                t('HASH'),
                t('UNICODE_RANGE'),
                t('INCLUDES'),
                t('DASHMATCH'),
                ':',
                t('ATKEYWORD'),
                ['(', SS, zeroOrMore(g('value')), ')'],
                ['[', SS, zeroOrMore(g('value')), ']']),
          SS]
}));

////////////////////////////////////////////////////////////////////////
// JSO TRANSLATOR
////////////////////////////////////////////////////////////////////////

// Runs callbacks based on the structure of the tokens, and returns the string
// contents of the token.
// This is currently bottom-up.
Token.prototype.run = function(callbackRegistry) {
  if (!callbackRegistry) {
    // No callback registry given, so set up a default one for debugging which
    // just logs the token: value pairs for all tokens.
    callbackRegistry = {};
    Object.keys(TABLES.Grammar).forEach(function(type) {
      callbackRegistry[type] = function(string) {
        log(type + ': "' + string + '"');
      };
    });
  }

  var contents = '';
  if (this.value instanceof Array) {
    this.value.forEach(function(value) {
      contents += (value instanceof Token) ?
          value.run(callbackRegistry) : value;
    });
  } else {
    contents = (this.value instanceof Token) ?
        this.value.run(callbackRegistry) : this.value;
  }

  if (this.type) {
    var callback = callbackRegistry[this.type];
    if (callback) {
      callback(contents);
    }
  }

  return contents;
};

// Strips all CSS comments from a stylesheet.
function stripComments(stylesheet) {
  return stylesheet.replace(/\/\*.*\*\//g, '');
}

// Extracts a parse object from a stylesheet, if one is found.
// Returns a pair { markup: ... (String), parseObject: ... (JSO, optional) }.
function extractMarkupAndParseObject(stylesheet) {
  var startParsedMarker = '/*{{{';
  var indexOfStart = stylesheet.indexOf(startParsedMarker);
  if (indexOfStart === -1) {
    return { markup: stylesheet };
  }
  var beforeParsed = stylesheet.slice(0, indexOfStart);
  var remainder = stylesheet.slice(indexOfStart + startParsedMarker.length);
  var endParsedMarker = '}}}*/';
  var indexOfEnd = remainder.indexOf(endParsedMarker);
  if (indexOfEnd === -1) {
    warn('Malformed parse object in stylesheet: ' + stylesheet);
    return { markup: stylesheet };
  }
  var parseObject = JSON.parse(remainder.slice(0, indexOfEnd));
  var afterParsed = remainder.slice(indexOfEnd + endParsedMarker.length);
  return { markup: (beforeParsed + afterParsed), parseObject: parseObject };
}

// Parses a text stylesheet into a JSO representation of the stylesheet.
//
// In the following representation, [...] indicates a list and {...} indicates
// an object, as expected.  Additionally, {{...}} indicates a map structure
// keyed by some value given as "key".
//
// {
//   traits: {{
//     "ident": {
//       params: [param1, param2, ...],
//       rules: [{
//         mixin: {
//           ident: "ident",
//           args: [arg1, arg2, ...],
//         },
//         declaration: "declaration",
//         nested: {
//           selector: "&...",
//           rules: [...]
//         }
//       }]
//     }
//   }},
//   rulesets: [{
//     selector: "selector",
//     rules: [{
//       mixin: {
//         ident: "ident",
//         args: [arg1, arg2, ...],
//       },
//       declaration: "declaration",
//       nested: {
//         selector: "&...",
//         rules: [...]
//       }
//     }]
//   }],
//   variables: {{
//     "ident": "value"
//   }}
// }
function parse(contents) {
  var markupAndParseObject = extractMarkupAndParseObject(contents);
  if (markupAndParseObject.parseObject) {
    return markupAndParseObject.parseObject;
  }

  var stylesheet = TABLES.Grammar.stylesheet(stripComments(contents));
  if (!stylesheet) {
    error('Unable to parse stylesheet: ' + contents);
    return;
  }

  if (isDebug) {
    stylesheet.run();
  }

  var jso = {
    traits: {},
    rulesets: [],
    variables: {}
  };
  var currentRule;
  var currentItems = [];
  var currentVariableIdent;

  function currentItem() {
    return currentItems[currentItems.length - 1];
  }

  stylesheet.run({
    selector: function(s) {
      // Trim the trailing spaces from the selector, they are bothersome.
      s = s.replace(/ *$/, '');
      if (currentItems.length === 0) {
        // Selector is for a ruleset at the top level.
        currentItems.push({ selector: s, rules: [] });
        jso.rulesets.push(currentItem());
      } else {
        // Selector is for a nested ruleset.
        currentItem().selector += s;
      }
    },
    declaration: function(s) {
      currentRule = { declaration: s };
      currentItem().rules.push(currentRule);
    },
    mixin_ident: function(s) {
      currentRule = { mixin: { ident: s, args: [] } };
      currentItem().rules.push(currentRule);
    },
    mixin_arg: function(s) {
      currentRule.mixin.args.push(s);
    },
    trait_ident: function(s) {
      if (currentItems.length > 0) {
        error('Traits can only be declared at the top level (for now...)');
        return;
      }
      currentItems.push({ params: [], rules: [] });
      jso.traits[s] = currentItem();
    },
    trait_param: function(s) {
      currentItem().params.push(s);
    },
    var_ident: function(s) {
      currentVariableIdent = s;
    },
    var_init: function(s) {
      jso.variables[currentVariableIdent] = s;
    },
    nested_decl: function(s) {
      currentRule = { nested: { selector: s, rules: [] } };
      currentItem().rules.push(currentRule);
      currentItems.push(currentRule.nested);
    },
    rulebody: function(s) {
      currentItems.pop();
    }
  });

  return jso;
}

// Pretty-prints a parse object as CSS.
function prettyPrint(parseObject) {
  // Gets the selector for a nested rule.
  function getNestedSelector(parentSelector, rule) {
    // See http://code.google.com/p/experimental-css/issues/detail?id=3 for
    // discussion on what the correct behaviour should be with commas.
    // It would be nice to precompile this, for efficiency.
    return parentSelector.split(',').map(function(outer) {
      outer = outer.trim();
      return rule.nested.selector.split(',').map(function(inner) {
        inner = inner.trim();
        if (inner.indexOf('&') !== 0) {
          inner = '& ' + inner;
        }
        return inner.replace(/&/g, outer);
      }).join(', ');
    }).join(', ');
  }

  // Flattens the parse object into:
  //   - a selector (.selector),
  //   - a list of resolved declarations (.declarations), and
  //   - recursively, a list of flattened nested blocks (.nested).
  // Variables, mixin arguments, and resulting selectors are resolved.
  function flatten(selector, rules, variables) {
    var declarations = [];
    var nested = [];
    rules.forEach(function(rule) {
      if (rule.declaration) {
        declarations.push(variables.substitute(rule.declaration));
      } else if (rule.nested) {
        nested.push(flatten(
            getNestedSelector(selector, rule), rule.nested.rules, variables));
      } else if (rule.mixin) {
         var trait = TRAITS.get(rule.mixin.ident);
         if (!trait) {
           return;
         }
         var args = rule.mixin.args;
         var params = trait.params;
         var env = variables.newEnvironment();
         for (var i = 0; i < args.length && i < params.length; i++) {
           env.set(params[i], new Variable(params[i], args[i], variables));
         }
         var flattenedMixin = flatten(selector, trait.rules, env);
         declarations = declarations.concat(flattenedMixin.declarations);
         nested = nested.concat(flattenedMixin.nested);
      }
    });
    return {
      selector: selector,
      declarations: declarations,
      nested: nested
    };
  }

  // Pretty-prints the flattened model.
  function ppFlattened(flattened) {
    var css = flattened.selector + ' {\n';
    flattened.declarations.forEach(function(decl) {
      css += '  ' + decl + ';\n';
    });
    css += '}\n';
    flattened.nested.forEach(function(nested) {
      css += ppFlattened(nested);
    });
    return css;
  }

  var css = '';
  parseObject.rulesets.forEach(function(ruleset) {
    css += ppFlattened(flatten(ruleset.selector, ruleset.rules, VARIABLES));
  });
  return css;
}

// Imports a parse object into the global TRAITS and VARIABLES namespace.
function importParseObject(parseObject) {
  TRAITS.importFromParseObject(parseObject);
  VARIABLES.importFromParseObject(parseObject);
}

////////////////////////////////////////////////////////////////////////
// IN-BROWSER EXCSS
////////////////////////////////////////////////////////////////////////

// A collection of traits.
function Traits() {
  this.traits = {};
}

// Gets the trait with the given identifier.
Traits.prototype.get = function(ident) {
  return this.traits[ident];
};

// Imports all trait definitions from a stylesheet.  Any existing traits with
// the same identifier will be overridden.
Traits.prototype.importFromParseObject = function(parseObject) {
  var self = this;
  var stylesheetTraits = parseObject.traits;
  Object.keys(stylesheetTraits).forEach(function(ident) {
    self.traits[ident] = stylesheetTraits[ident];
  });
};

// A variable is a boxed value which may itself be a Variable or a reference
// to a variable.  If the latter, the Variable instance will attempt to be
// resolved from a Variables environment if one is given.
//
function Variable(ident, value, variables) {
  this.ident = ident;
  this.bind(value, variables);
  // Can't use instanceof because Variable can be shared across (function{}())
  // invocations if ExCSS is included multiple times.
  this.isVariable = true;
}

// Gets the name of the variable.  This is a simple function of the ident; a
// variable with ident "foo" has name "$foo", etc.
Variable.prototype.getName = function() {
  return '$' + this.ident;
};

// Gets the value of the variable without attempting to resolve links to other
// variables.
Variable.prototype.getValue = function() {
  return this.value;
};

// Gets the value of this variable, deeply resolving links to other variables
// and avoiding circular references.
Variable.prototype.resolve = function() {
  if (!this.value.isVariable) {
    return this.value;
  }
  if (this.mark) {
    warn('Circular reference while resolving \"' + this.ident + '\"');
    return undefined;
  }
  this.mark = true;
  var resolved = this.value.resolve();
  delete this.mark;
  return resolved;
};

// Sets the value of this variable, which may be a variable or a reference
// to a variable.  If the latter, the Variable instance will attempt to be
// resolved from a Variables environment if one is given.
Variable.prototype.bind = function(value, variables) {
  if (variables && value.indexOf && value.indexOf('$') === 0) {
    var variable = variables.get(value.slice('$'.length));
    if (variable) {
      value = variable;
    } else {
      warn('Attempted to bind "' + this.ident + '" to unknown variable "' +
           value + '"');
    }
  }
  this.value = value;
};

// A collection of variables with methods to set and get variables by their
// identifier, deeply resolve variable values, perform a complete substitution
// for a string, and maintain a heirarchy of variables in an environment-type
// way for managing nesting and local variables.
function Variables(parent) {
  if (parent && !parent.variables) {
    throw new Error('Parent must be an instance of Variables');
  }
  this.parent = parent;
  this.variables = {};
}

// Creates a new environment for this collection, for local manipulation
// (e.g. local variables, mixin parameters, etc).
Variables.prototype.newEnvironment = function() {
  return new Variables(this);
};

// Imports a collection of variables from a Stylesheet.
Variables.prototype.importFromParseObject = function(parseObject) {
  var self = this;

  // Naively import without worrying about references to other variables, e.g.
  //   @var foo 10px;
  //   @var bar $foo;
  //   @var baz $bar;
  var stylesheetVariables = parseObject.variables;
  Object.keys(stylesheetVariables).forEach(function(ident) {
    self.variables[ident] = new Variable(ident, stylesheetVariables[ident]);
  });

  // Resolve references of variables to other variables now that they've all
  // been created.
  // FIXME: this is actually overly simplistic, as the variable could actually
  // resolve to any expression such as
  //   @var qux calc($foo + $bar)
  // or, if the variable syntax is extended to be more intelligent,
  //   @var lengthInPx $(length)px
  // In other words, this probably calls for an Expression class, although
  // hopefully all it needs to be is an array of strings and variables.
  Object.keys(this.variables).forEach(function(ident) {
    var variable = self.variables[ident];
    self.variables[ident].bind(variable.getValue(), self);
  });
};

// Sets the variable with a given ident to a given value.  If no existing
// value for the variable exists, it will be created.
Variables.prototype.set = function(ident, variable) {
  if (!variable.isVariable) {
    throw new Error('Variable must be an instance of Variable');
  }
  this.variables[ident] = variable;
};

// Gets the value of a variable from the collection.
Variables.prototype.get = function(ident) {
  if (this.variables.hasOwnProperty(ident)) {
    return this.variables[ident];
  }
  return this.parent ? this.parent.get(ident) : undefined;
};

// Returns all variables in this collection, including those from the parent
// (excluding those from the parent which are already present in this scope).
Variables.prototype.getAllVariables = function() {
  var self = this;
  var allVariables = this.parent ? this.parent.getAllVariables() : {};
  Object.keys(this.variables).forEach(function(ident) {
    allVariables[ident] = self.variables[ident];
  });
  return allVariables;
};

// Over a given string expression, substitutes identifiers with values for all
// variables in this collection.  Variable occurences are resolved deeply (see
// "resolve" above).
Variables.prototype.substitute = function(expression) {
  var allVariables = this.getAllVariables();
  // Calculate the list of idents sorted by length descending, so that when
  // replacement happens longer variables e.g. $foobar are replaced before
  // shorter ones e.g. $foo.
  var identsByLengthDesc = Object.keys(allVariables).sort(function(i0, i1) {
    return i1.length - i0.length;
  });

  for (var i = 0; i < identsByLengthDesc.length; i++) {
    var ident = identsByLengthDesc[i];
    var variable = allVariables[ident];
    while (expression.indexOf(variable.getName()) >= 0) {
      expression = expression.replace(variable.getName(), variable.resolve());
    }
  }

  return this.parent ? this.parent.substitute(expression) : expression;
};

// Encapsulates an ExCSS stylesheet.  Internally this is represtented as a
// "parse object" as returned by the parse() function, paired with a style
// element in which to inject real CSS.
function Stylesheet(parseObject, styleElement) {
  this.parseObject = parseObject;
  this.styleElement = styleElement;
}

// Returns the parse object contained in this stylesheet.
Stylesheet.prototype.getParseObject = function() {
  return this.parseObject;
};

// Creates an ExCSS stylesheet object from a style element of type text/excss.
Stylesheet.createFromStyleElement = function(styleElement) {
  if (styleElement.type !== 'text/excss') {
    throw new Error('Style element isn\'t ExCSS');
  }
  var parseObject = parse(styleElement.innerHTML);
  if (!parseObject) {
    warn('Failed to parse style element: ' + styleElement.innerHTML);
    return null;
  }
  return new Stylesheet(parseObject, styleElement);
};

// Creates an ExCSS stylesheet object from a link element of type text/excss, by
// using XHR to get the markup from the stylesheet linked to.
Stylesheet.createFromLinkElement = function(linkElement) {
  if (linkElement.type !== 'text/excss') {
    throw new Error('Link element didn\'t have type text/excss');
  }
  var url = linkElement.href;
  if (!url) {
    warn('Link element didn\'t have a valid href');
    return null;
  }

  var responseText = instrument('  XHR for ' + url, function() {
    var request = new window.XMLHttpRequest();
    request.open('GET', url, false);
    request.send(null);
    return (request.status === 200) ? request.responseText : undefined;
  });
  if (!responseText) {
    warn('Failed to fetch ' + url);
    return null;
  }

  var parseObject = instrument('  Parsing...', function() {
    return parse(responseText);
  });
  if (!parseObject) {
    warn('Failed to parse the stylesheet from ' + url);
    return null;
  }

  var styleElement = instrument('  DOM bs...', function() {
    styleElement = document.createElement('style');
    styleElement.setAttribute('link_href', linkElement.href);
    var linkAttributes = linkElement.attributes;
    for (var i = 0; i < linkAttributes.length; i++) {
      if (linkAttributes.item(i).name !== 'type' &&
          linkAttributes.item(i).name !== 'href') {
        styleElement.setAttribute(linkAttributes.item(i).name,
                                  linkAttributes.item(i).value);
      }
    }
    linkElement.parentNode.insertBefore(styleElement, linkElement);
    linkElement.parentNode.removeChild(linkElement);
    return styleElement;
  });
  return new Stylesheet(parseObject, styleElement);
};

// Injects CSS markup into the style element owned by this stylesheet, based on
// the state of the parse object and ExCSS variables.
Stylesheet.prototype.injectCss = function() {
  if (!this.styleElement) {
    throw new Error('Stylesheet hasn\'t been constructed with a style element');
  }
  if (!this.styleElement.parentNode) {
    warn('CSS will be injected, but style node isn\'t attached to anything');
  }

  var css = prettyPrint(this.parseObject);

  if (css.trim() === '') {
    warn('CSS injection is empty.  This might be because the original ExCSS ' +
         'markup was empty, or because the original ExCSS markup has syntax ' +
         'errors, or because ExCSS has a bug.  If the latter, please file at ' +
         'http://code.google.com/p/experimental-css');
  }

  this.styleElement.type = 'text/css';
  this.styleElement.innerHTML = css;
};

////////////////////////////////////////////////////////////////////////
// GLOBALS
////////////////////////////////////////////////////////////////////////

function getVariable(ident) {
  var variable = VARIABLES.get(ident);
  if (!variable) {
    return undefined;
  }
  var value = variable.getValue();
  // Don't resolve variables; if "bar" resolves to the variable "foo", just
  // return "$foo" rather than its value.
  return value.isVariable ? variable.getName() : value;
}

function setVariable(ident, value) {
  var variable = VARIABLES.get(ident);
  if (!variable) {
    return;
  }
  variable.bind(value, VARIABLES);
  STYLESHEETS.forEach(function(stylesheet) {
    stylesheet.injectCss();
  });
}

if (!window.CSS) {
  window.CSS = {
    // Actual dynamic API.
    getVariable: getVariable,
    setVariable: setVariable,
    // Functionality exported for non-browser tools (and debugging).
    parse: parse,
    extractMarkupAndParseObject: extractMarkupAndParseObject,
    prettyPrint: prettyPrint,
    importParseObject: importParseObject,
    // The "locals" are values needed across multiple browser inclusions of
    // ExCSS -- which maybe there are.  In convoluted-land.  Try to hide them.
    __locals__: {
      VARIABLES: new Variables(),
      TRAITS: new Traits(),
      STYLESHEETS: []
    }
  };
}

var VARIABLES = window.CSS.__locals__.VARIABLES;
var TRAITS = window.CSS.__locals__.TRAITS;
var STYLESHEETS = window.CSS.__locals__.STYLESHEETS;

////////////////////////////////////////////////////////////////////////
// IN-BROWSER ENTRY POINT
////////////////////////////////////////////////////////////////////////

function runExCssFromBrowser() {
  var nodes = document.querySelectorAll('[type="text/excss"]');
  Array.prototype.slice.call(nodes).forEach(function(node, i) {
    var tagName = node.tagName.toLowerCase();
    instrument('Parsing <' + tagName + '> ' + i, function() {
      var stylesheet;
      if (tagName === 'style') {
        stylesheet = Stylesheet.createFromStyleElement(node);
      } else if (tagName === 'link') {
        stylesheet = Stylesheet.createFromLinkElement(node);
      } else {
        warn('type="text/excss" set on invalid node type "' + tagName + '"');
        return;
      }
      if (isDebug) {
        log(JSON.stringify(stylesheet.getParseObject(), null, 2));
      }
      STYLESHEETS.push(stylesheet);
      importParseObject(stylesheet.getParseObject());
    });
  });

  STYLESHEETS.forEach(function(stylesheet, i) {
    instrument('Injecting stylesheet ' + i, function() {
      stylesheet.injectCss();
    });
  });
}

if (document) {
  instrument('Running ExCSS', runExCssFromBrowser);
}

}(window));
