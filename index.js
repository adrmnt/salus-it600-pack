"use strict";

const https = require('https')
var parse = require('fast-json-parse')

const baseUrl = "eu.salusconnect.io";
const loginUrl = "/users/sign_in.json?";
const apiVersion = "/apiv1";
const devicesUrl = "/devices.json?";

const prop = "ep_9:sIT600TH:";
const propTemperature = prop + "LocalTemperature_x100";
const propHumidity = prop + "SunnySetpoint_x100";
const propHeatingSetpoint = prop + "HeatingSetpoint_x100";
const propRunningMode = prop + "RunningState";
const propState = prop + "HoldType";
const propUpdateTargetTemperature = prop + "SetHeatingSetpoint_x100";
const propUpdateState = prop + "SetHoldType";

class Index {

    constructor({username, password, thermostatModels=[]}) {
        this.username = username;
        this.password = password;
        this.thermostatModels = thermostatModels.map(function (e) { return e.toUpperCase().replace(/^VS(10|20)\w+/, "IT600THERMHW") });
    }

    async getToken() {
        await this.login();

        function Token(value, creationDay) {
            this.value = value;
            this.creationDay = creationDay;
        }

        return new Token(this.token, new Date().getDate());
    }

    login() {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({user: {email: this.username, password: this.password}})
            const options = {
                host: baseUrl,
                port: 443,
                path: loginUrl + this.appendTimestamp(),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            }

            const req = https.request(options, res => {
                res.on('data', d => {
                    this.token = parse(d.toString()).value.access_token;
                    resolve(this.token);
                })
            })
            req.on('error', error => {
                console.error(error)
            })
            req.write(data)
            req.end()
        })
    }

    async getDevices(token) {
        if (token !== null) {
            const allDevices = await this.getData(token, apiVersion + devicesUrl + this.appendTimestamp());

            function Item(id, name, current, target, heating, humidity, state) {
                this.id = id;
                this.name = name;
                this.current = current;
                this.target = target;
                this.heating = heating;
                this.humidity = humidity;
                this.state = state;
            }

            const result = [];
            try {
                for (const e of allDevices.value) {
                    const device = e.device;
                    if (this.thermostatModels.includes(device.oem_model.toUpperCase())) {
                        const current = this.getData(token, apiVersion + "/dsns/" + device.dsn + "/properties/" + propTemperature + ".json?" + this.appendTimestamp());
                        const target = this.getData(token, apiVersion + "/dsns/" + device.dsn + "/properties/" + propHeatingSetpoint + ".json?" + this.appendTimestamp());
                        const heating = this.getData(token, apiVersion + "/dsns/" + device.dsn + "/properties/" + propRunningMode + ".json?" + this.appendTimestamp());
                        const humidity = this.getData(token, apiVersion + "/dsns/" + device.dsn + "/properties/" + propHumidity + ".json?" + this.appendTimestamp());
                        const state = this.getData(token, apiVersion + "/dsns/" + device.dsn + "/properties/" + propState + ".json?" + this.appendTimestamp());

                        await Promise.all([current, target, heating, humidity, state]).then((values) => {
                            result.push(new Item(device.dsn, device.product_name, values[0].value.property.value / 100, values[1].value.property.value / 100, values[2].value.property.value != 0 ? true : false, values[3].value.property.value, values[4].value.property.value));
                        });
                    }
                }
                return result;
            } catch (error) {
                console.error(error);
            }
        } else {
            console.warn("Salus login failed");
        }
    }

    async getDeviceCurrentTemperature(token, id) {
        return (await this.getData(token, apiVersion + "/dsns/" + id + "/properties/" + propTemperature + ".json?" + this.appendTimestamp())).value.property.value / 100;
    }

    async getDeviceTargetTemperature(token, id) {
        return (await this.getData(token, apiVersion + "/dsns/" + id + "/properties/" + propHeatingSetpoint + ".json?" + this.appendTimestamp())).value.property.value / 100;
    }

    async getDeviceHeating(token, id) {
        return (await this.getData(token, apiVersion + "/dsns/" + id + "/properties/" + propRunningMode + ".json?" + this.appendTimestamp())).value.property.value !== 0 ? true : false;
    }

    async getDeviceCurrentRelativeHumidity(token, id) {
        return (await this.getData(token, apiVersion + "/dsns/" + id + "/properties/" + propHumidity + ".json?" + this.appendTimestamp())).value.property.value;
    }

    async getDeviceState(token, id) {
        return (await this.getData(token, apiVersion + "/dsns/" + id + "/properties/" + propState + ".json?" + this.appendTimestamp())).value.property.value;
    }

    getData(token, path) {
        return new Promise((resolve, reject) => {
            const options = {
                host: baseUrl,
                port: 443,
                path: path,
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            }

            const req = https.request(options, res => {
                res.on('data', d => {
                    resolve(parse(d.toString()));
                })
            })
            req.on('error', error => {
                reject(error);
            })
            req.end()
        })
    }

    setData(token, path, data) {
        return new Promise((resolve, reject) => {
            const options = {
                host: baseUrl,
                port: 443,
                path: path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length,
                    'Authorization': 'Bearer ' + token
                }
            }

            const req = https.request(options, res => {
                resolve(res.statusCode);
            })
            req.on('error', error => {
                console.error(error)
            })
            req.write(data)
            req.end()
        })
    }
    
    async updateTemperature(token, id, temperature) {
        const data = JSON.stringify({"datapoint": {"value": temperature * 100}});
        return (await this.setData(token, apiVersion + "/dsns/" + id + "/properties/" + propUpdateTargetTemperature + "/datapoints.json?" + this.appendTimestamp(), data))
    }

    async updateState(token, id, state) {
        /*
        standby = 7
        hold = 2
        auto/ program = 0
        */
        const data = JSON.stringify({"datapoint": {"value": state}});
        return (await this.setData(token, apiVersion + "/dsns/" + id + "/properties/" + propUpdateState + "/datapoints.json?" + this.appendTimestamp(), data))
    }

    appendTimestamp() {
        return "timestamp=" + new Date().getTime();
    }
}

module.exports = Index;
