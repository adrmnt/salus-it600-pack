"use strict";

const https = require('https')

const baseUrl = "eu.salusconnect.io";
const loginUrl = "/users/sign_in.json?";
const apiVersion = "/apiv1";
const devicesUrl = "/devices.json?";

const atrTemperature = "LocalTemperature_x100";
const atrHumidity = "SunnySetpoint_x100";
const atrHeatingSetpoint = "HeatingSetpoint_x100";
const atrRunningMode = "RunningMode";

const oem_model = "SQ610";

class Index {

    constructor({username, password}) {
        this.username = username;
        this.password = password;
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
                    this.token = JSON.parse(d.toString()).access_token;
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

    async getDevices() {
        await this.login();
        return new Promise((resolve, reject) => {
            const options = {
                host: baseUrl,
                port: 443,
                path: apiVersion + devicesUrl + this.appendTimestamp(),
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + this.token
                }
            }

            const req = https.request(options, res => {
                res.on('data', async d => {
                    const result = [];

                    function Item(id, name, currentTemperature, targetTemperature, humidity, heating) {
                        this.id = id;
                        this.name = name;
                        this.current = currentTemperature;
                        this.target = targetTemperature;
                        this.humidity = humidity;
                        this.heating = heating;
                    }

                    for (const e of JSON.parse(d.toString())) {
                        const device = e.device;
                        if (device.oem_model === oem_model) {
                            const deviceInfo = await this.getCurrentState(device.dsn);
                            result.push(new Item(device.dsn, device.product_name, deviceInfo.temperature, deviceInfo.heatingSetpoint, deviceInfo.humidity, deviceInfo.runningMode));
                        }
                    }
                    resolve(JSON.stringify(result));
                })
            })

            req.on('error', error => {
                console.error(error)
            })

            req.end()
        })
    }

    getCurrentState(id) {
        return new Promise((resolve, reject) => {
            if (!id)
                throw new Error("ID argument must be set");
            const buffers = [];

            const options = {
                host: baseUrl,
                port: 443,
                path: apiVersion + "/dsns/" + id + "/properties.json?" + this.appendTimestamp(),
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + this.token
                }
            }

            const req = https.request(options, res => {
                res.on('data', d => {
                    buffers.push(d)
                })
                res.on('end', function () {

                    function Item(id, displayName, temperature, humidity, heatingSetpoint, runningMode) {
                        this.id = id;
                        this.displayName = displayName;
                        this.temperature = temperature;
                        this.humidity = humidity;
                        this.heatingSetpoint = heatingSetpoint;
                        this.runningMode = runningMode;
                    }

                    let roomName = "";
                    let temperature = 0;
                    let humidity = 0;
                    let heatingSetpoint = 0;
                    let runningMode = false;

                    JSON.parse(Buffer.concat(buffers).toString()).forEach(e => {
                        if (e.property.display_name === atrTemperature) {
                            temperature = e.property.value;
                        }
                        if (e.property.display_name === atrHumidity) {
                            humidity = e.property.value;
                        }
                        if (e.property.display_name === atrHeatingSetpoint) {
                            heatingSetpoint = e.property.value;
                            roomName = e.property.product_name;
                        }
                        if (e.property.display_name === atrRunningMode) {
                            if (e.property.value !== 0) {
                                runningMode = true;
                            }
                        }
                    });
                    resolve(new Item(id, roomName, temperature, humidity, heatingSetpoint, runningMode));
                })
            })
            req.on('error', error => {
                console.error(error)
            })
            req.end()
        })
    }

    async updateTemperature(id, temperature) {
        await this.login();
        return new Promise((resolve, reject) => {
            if (!id || !temperature)
                throw new Error("Both ID and temperature named arguments must be set");

            const data = JSON.stringify({"datapoint": {"value": temperature}})
            const options = {
                host: baseUrl,
                port: 443,
                path: apiVersion + "/dsns/" + id + "/properties/ep_9:sIT600TH:SetHeatingSetpoint_x100/datapoints.json?" + this.appendTimestamp(),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length,
                    'Authorization': 'Bearer ' + this.token
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