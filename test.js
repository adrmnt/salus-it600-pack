const Salus = require("./index");
const salus = new Salus({username: "user@email.com", password: "Password!", thermostatModel:"SQ610"});

class TestClass {
    async myTest() {
        const token = await salus.getToken();
        const devices = await salus.getDevices(token.value);
        devices.forEach((device) => {
            console.log(device.name)
        })
    }
}

var testClass = new TestClass();
testClass.myTest();