var subview = require('subview'),
    cursor  = require('../cursor'),
    click   = require('onclick');

require('./Field.less');

click('.view-Code-Field', function(e) {
    subview(this).focus();
});

module.exports = subview('Code-Field', {
    dump: function() {

    },
    focus: function() {
        cursor.appendTo(this.$wrapper);
        return this;
    },
    run: function(callback) {
        var stack = [],
            token,
            prev,
            next;

        //Get Tokens
        var tokens = this.$wrapper.children('.view-Code-Token');

        //Ignore Empty Lines
        if(tokens.length === 0) {
            return;
        }
        //Special Case for one async token (for & while loops)
        else if(tokens.length === 1) {
            token = subview(tokens[0]);

            if(token.isAsync) {
                token.run(function(result) {
                    if(callback) {
                        callback(result);
                    }
                });

                return;
            }
        }

        //Build Stack
        for(var i=0; i<tokens.length; i++) {
            token = subview(tokens[i]);

            if(token.isOperator) {
                stack.push(token);
            }
            else if(token.isLiteral) {
                //++ and -- that must operate on the raw variable
                next = subview(tokens[i + 1]);
                if(token && token.isVar && next.isVarOperator) {
                    stack.push(next.run(token));
                    i++;
                }
                else {
                    stack.push(token.val());
                }
            }
            else if(token.isToken) {
                stack.push(token.run());
            }
            else if(token.type != 'Code-Cursor') {
                console.error("Token not recognized");
            }
        }

        //Reduce operators
        var maxPrecedence = 5 + 1;
        while(maxPrecedence-- && stack.length > 1) {
            for(i=0; i<stack.length; i++) {
                token = stack[i];

                //Null tokens should be discarded
                //They are returned when a statement cancels its self out like NOT NOT or --4
                if(token && token.isNull) {
                    stack.splice(i, 1);
                    i--;
                }
                else if(token && token.isOperator && (typeof token.precedence == 'function' ? token.precedence(stack, i) : token.precedence) == maxPrecedence) {
                    //Operators like NOT that only operate on the token after
                    if(token.isSingleOperator) {
                        stack.splice(i, 2, token.run(stack[i + 1]));
                        i--;
                    }
                    //Standard operators that operate on token before and after
                    else {
                        prev = stack[i - 1];
                        next = stack[i + 1];

                        if(i === 0) {
                            token.error('No left-side for ' + token.template);
                            return;
                        }
                        else if(i == stack.length - 1) {
                            token.error('No right-side for ' + token.template);
                            return;
                        }
                        else if(prev && prev.isOperator) {
                            token.error('Invalid right-side for ' + token.template);
                        }
                        else if(next && next.isOperator) {
                            token.error('Invalid left-side for ' + token.template);
                        }
                        else {
                            stack.splice(i - 1, 3, token.run(prev, next));
                            i--;
                        }
                    }
                }
            }
        }

        //The stack should reduce to exactly one literal
        if(stack.length !== 1) {
            this.error("Syntax Error");
        }
        else {
            if(callback) {
                callback(stack[0]);
            }

            return stack[0];
        }
    },
    error: require('./error')
});
