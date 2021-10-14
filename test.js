const Salus = require("./index");
const salus = new Salus({username: "email@test.com", password: "Password!"});

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