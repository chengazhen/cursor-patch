const hex = "437572736f72";
const name_lower = Buffer.from(hex, 'hex').toString('utf8').toLowerCase();
const name_capitalize = Buffer.from(hex, 'hex').toString('utf8');

module.exports = {
	name_lower,
	name_capitalize,
};