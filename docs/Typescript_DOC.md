*file used throughout development to understand Typescript language*  

**Disclaimer !** i'm aware this documentation is not perfect and/or missing elements so in case of doubt please check [TypescriptDoc](https://www.typescriptlang.org/docs/)  

***If you haven't read/learn the Javascript_DOC yet please do so ! The understanding of Javascript is necessery to learn Typescript***

# What is Typescript  

TypeScript = JavaScript + types (and some language features) → then compiled into JavaScript  

# Base type  

var     ---> Kind of a global variable that can be redeclared but it's better to avoid
let     ---> function/block variable that can be reassigned  
const   ---> function/block variable that is constant  

We are going to mostly use let/const way to define a variable  

let age: number = 25;  
let name: string = "Guillaume";  
let ok: boolean = true;  

let ids: number[] = [1, 2, 3];  
let tags: Array<string> = ["a", "b"];  

let anything: any = 123;       // to avoid (we won't use them)  
let unknownValue: unknown = 123; // to avoid but better then any (we won't use them)  

From those example we can see the syntax to create a variable is as follow: - define the variable (var or let or const)  
                                                                            - name of the variable follow by ':' (age:)  
                                                                            - type of the variable (number, string, boolean...)  
                                                                            - value of the varaible (25). This step is optional since the value can be set after/changed afterward unless it's a cont variable  

# Object Type  

