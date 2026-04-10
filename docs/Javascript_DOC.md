*file used throughout development to understand Typescript language*  

**Disclaimer !** i'm aware this documentation is not perfect and/or missing elements so in case of doubt please check [JavascriptDoc](https://developer.mozilla.org/fr/docs/Web/JavaScript).  
I'm also considering the fact you are probably a 42 student and you are knowledgeable about c/c++ and basic algorithmics.  

# What is Javascript  

JavaScript is a scripting language that is cross-platform and object-oriented. It is a lightweight language that must be part of a host environment (such as a web browser) in order to be used on objects in that environment.  

# Type and Grammar  

## Base of the language  

### Comments  

Like c or c++ : - \\        For the line   
                - \* */     For multiple line  


### Declaration  

var     ---> Kind of a global variable that can be redeclared but it's better to avoid  
let     ---> function/block variable that can be reassigned  
const   ---> function/block variable that is constant  

expmple of declaration : let x = 42;  

### Data types  

Javascript is not a type language so the interpreter will by himself deduce the data type of the variable.  

Here are the differents data types : - 