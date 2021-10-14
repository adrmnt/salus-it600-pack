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
const propRunningMode = prop + "RunningMode";

const oem_model = "SQ610";

class Index {

    constructor({username, password}) {
        this.username = username;
        this.password = password;
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

            function Item(id, name, current, target, heating) {
                this.id = id;
                this.name = name;
                this.current = current;
                this.target = target;
                this.heating = heating;
            }

            const result = [];

            try {
                for (const e of allDevices.value) {
                    const device = e.device;
                    if (device.oem_model === oem_model) {
                        const current = (await this.getData(token, apiVersion + "/dsns/" + device.dsn + "/properties/" + propTemperature + ".json?" + this.appendTimestamp())).value.property.value / 100;
                        const target = (await this.getData(token, apiVersion + "/dsns/" + device.dsn + "/properties/" + propHeatingSetpoint + ".json?" + this.appendTimestamp())).value.property.value / 100;
                        const heating = (await this.getData(token, apiVersion + "/dsns/" + device.dsn + "/properties/" + propRunningMode + ".json?" + this.appendTimestamp())).value.property.value !== 0 ? true : false;

                        result.push(new Item(device.dsn, device.product_name, current, target, heating));
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

    async updateTemperature(token, id, temperature) {
        await this.login();
        return new Promise((resolve, reject) => {
            if (!id || !temperature)
                throw new Error("Both ID and temperature named arguments must be set");

            const data = JSON.stringify({"datapoint": {"value": temperature * 100}})
            const options = {
                host: baseUrl,
                port: 443,
                path: apiVersion + "/dsns/" + id + "/properties/ep_9:sIT600TH:SetHeatingSetpoint_x100/datapoints.json?" + this.appendTimestamp(),
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

    appendTimestamp() {
        return "timestamp=" + new Date().getTime();
    }
}

module.exports = Index;