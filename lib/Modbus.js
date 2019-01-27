var fs        = require("fs");
var util      = require("util");
var path      = require("path");
var Exception = require("./Exception");
var Helpers   = require("./Helpers");
var Buff      = require("./Buffer");

const protocols = {
	GET_COMM_EVENT_COUNTER: require('./protocol/GET_COMM_EVENT_COUNTER'),
	GET_COMM_EVENT_LOG: require('./protocol/GET_COMM_EVENT_LOG'),
	MASK_WRITE_REGISTER: require('./protocol/MASK_WRITE_REGISTER'),
	READ_COILS: require('./protocol/READ_COILS'),
	READ_DEVICE_IDENTIFICATION: require('./protocol/READ_DEVICE_IDENTIFICATION'),
	READ_DISCRETE_INPUTS: require('./protocol/READ_DISCRETE_INPUTS'),
	READ_EXCEPTION_STATUS: require('./protocol/READ_EXCEPTION_STATUS'),
	READ_FIFO_QUEUE: require('./protocol/READ_FIFO_QUEUE'),
	READ_FILE_RECORD: require('./protocol/READ_FILE_RECORD'),
	READ_HOLDING_REGISTERS: require('./protocol/READ_HOLDING_REGISTERS'),
	READ_INPUT_REGISTERS: require('./protocol/READ_INPUT_REGISTERS'),
	READ_WRITE_MULTIPLE_REGISTERS: require('./protocol/READ_WRITE_MULTIPLE_REGISTERS'),
	WRITE_FILE_RECORD: require('./protocol/WRITE_FILE_RECORD'),
	WRITE_MULTIPLE_COILS: require('./protocol/WRITE_MULTIPLE_COILS'),
	WRITE_MULTIPLE_REGISTERS: require('./protocol/WRITE_MULTIPLE_REGISTERS'),
	WRITE_SINGLE_COIL: require('./protocol/WRITE_SINGLE_COIL'),
	WRITE_SINGLE_REGISTER: require('./protocol/WRITE_SINGLE_REGISTER'),
}

load();

exports.Exception = Exception;
exports.Package   = function (fcode, data) {
	var buffer = Buff.alloc(data.length + 1);

	buffer.writeUInt8(fcode, 0);
	Buff.from(data).copy(buffer, 1);

	return buffer;
};

exports.Helpers = {
	blocksToBuffer : Helpers.blocksToBuffer,
	bitsToBuffer   : Helpers.bitsToBuffer,

	bufferToBlocks : Helpers.bufferToBlocks,
	bufferToBits   : Helpers.bufferToBits,
};

Exception.load(exports);

function load() {
	for (let protocolName of Object.keys(protocols)) {
		var camelName = protocolName[0].toUpperCase() + protocolName.substr(1).toLowerCase().replace(/_(\w)/g, function (m, c) {
			return c.toUpperCase();
		});
		const funct = protocols[protocolName]

		exports[camelName] = {
			Code     : funct.code,
			Request  : {
				build : proxy(funct, "buildRequest"),
				parse : function (buffer) {
					// byte 1 is function code
					return funct.parseRequest(buffer.slice(1));
				}
			},
			Response : {
				build : proxy(funct, "buildResponse"),
				parse : function (buffer) {
					// byte 1 is function code
					return funct.parseResponse(buffer.slice(1));
				}
			}
		};
	}

	exports.Request = function (buffer) {
		var code = buffer.readUInt8(0);

		for (var k in exports) {
			if (typeof exports[k] === "object" && exports[k].Code === code) {
				var data = exports[k].Request.parse(buffer);

				if (typeof data === "object" && !util.isArray(data) && data !== null) {
					data.code = k;
				} else {
					data = { code: k, data: data };
				}

				return data;
			}
		}

		return {
			code : buffer[0],
			data : buffer.slice(1)
		};
	};

	exports.Response = function (buffer) {
		var code = buffer.readUInt8(0);

		if (code & 0x80) {
			return Exception.parse(buffer);
		}

		for (var k in exports) {
			if (typeof exports[k] === "object" && exports[k].Code === code) {
				var data = exports[k].Response.parse(buffer);

				if (typeof data === "object" && !util.isArray(data) && data !== null) {
					data.code = k;
				} else {
					data = { code: k, data: data };
				}

				return data;
			}
		}

		return {
			code : buffer[0],
			data : buffer.slice(1)
		};
	};
}

function proxy(funct, method) {
	return function () {
		var stream = funct[method].apply(funct, arguments);
		var buffer = Buff.alloc(stream.length + 1);

		buffer[0] = funct.code;

		stream.copy(buffer, 1);

		return buffer;
	};
}
