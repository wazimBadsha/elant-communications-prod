// helper.js
const _ = require('lodash');

// Deep clone an object
const deepClone = (obj) => {
    return _.cloneDeep(obj);
};

// Merge two objects deeply
const deepMerge = (obj1, obj2) => {
    return _.merge({}, obj1, obj2);
};

// Check if a value is null or undefined
const isNil = (value) => {
    return _.isNil(value);
};

// Get the unique values of an array
const getUniqueValues = (array) => {
    return _.uniq(array);
};

// Group array elements by a specific key
const groupByKey = (array, key) => {
    return _.groupBy(array, key);
};

// Sort an array of objects by a specific key
const sortByKey = (array, key) => {
    return _.sortBy(array, [key]);
};

// Find the maximum value in an array of numbers
const findMaxValue = (array) => {
    return _.max(array);
};

// Find the minimum value in an array of numbers
const findMinValue = (array) => {
    return _.min(array);
};

// Debounce a function
const debounce = (func, wait) => {
    return _.debounce(func, wait);
};

// Throttle a function
const throttle = (func, wait) => {
    return _.throttle(func, wait);
};

// Get a deeply nested property from an object
const getNestedProperty = (obj, path, defaultValue) => {
    return _.get(obj, path, defaultValue);
};

// Set a deeply nested property in an object
const setNestedProperty = (obj, path, value) => {
    return _.set(obj, path, value);
};

// Remove a property from an object
const omitProperty = (obj, path) => {
    return _.omit(obj, path);
};

// Check if an object has a certain property
const hasProperty = (obj, path) => {
    return _.has(obj, path);
};

// Create a new object with only the specified properties
const pickProperties = (obj, paths) => {
    return _.pick(obj, paths);
};

// Flatten a deeply nested array
const flattenDeep = (array) => {
    return _.flattenDeep(array);
};

// Find the difference between two arrays
const difference = (array1, array2) => {
    return _.difference(array1, array2);
};

// Chunk an array into smaller arrays of a specified size
const chunkArray = (array, size) => {
    return _.chunk(array, size);
};

// Capitalize the first letter of a string
const capitalizeString = (str) => {
    return _.capitalize(str);
};

// Shuffle the elements of an array
const shuffleArray = (array) => {
    return _.shuffle(array);
};

module.exports = {
    deepClone,
    deepMerge,
    isNil,
    getUniqueValues,
    groupByKey,
    sortByKey,
    findMaxValue,
    findMinValue,
    debounce,
    throttle,
    getNestedProperty,
    setNestedProperty,
    omitProperty,
    hasProperty,
    pickProperties,
    flattenDeep,
    difference,
    chunkArray,
    capitalizeString,
    shuffleArray
};


// const helpers = require('./helper');

// const exampleObj = { a: 1, b: { c: 2 } };
// const clonedObj = helpers.deepClone(exampleObj);
// console.log(clonedObj);

// const uniqueValues = helpers.getUniqueValues([1, 2, 2, 3, 4]);
// console.log(uniqueValues);