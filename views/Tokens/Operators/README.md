A basic operator-precedence parser is implemented in Editor/Field.js.  The precedences are defined here in the Operators and is summarized as follows with high numbers having higher precedence:

0:  Boolean
1:  Comparators
2:  Minus, Plus
3:  Divide, Multiply
4:  Exp
5:  NOT, Negation
oo: Literals, Parentheses, Functions 
    (not explicitly defined, but treated this way by the parser)