
//hacked up javascript clone object method from stackoverflow. certainly a blemish on the face of JS

function clone(obj) {
    //3 simple types and null / undefined
    if(null == obj || "object" != typeof obj) return obj;

    //date
    if(obj instanceof Date) {
        var copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    //array
    if (obj instanceof Array) {
        var copy = [];
        for( var i = 0; i < obj.length; ++i) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }

    //object
    if(obj instanceof Object) {
        var copy = {};
        for(var attr in obj) {
            if(obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }
    throw new Error("object type not supported yet!");
}


/*****************CLASSES*******************/
