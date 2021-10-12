# Salus iT600 

A JavaScript package to communicate with Salus internet connected thermostats.


## Installation

```bash
npm install salus-it600-pack
```

## Usage

```javascript
const Salus = require("salus-it6000-pack");
const salus = new Salus({ username: "example@email.com", password: "password" });

// get devices (only thermostats)
await salus.getDevices().then(res => console.log(res))

// set temperature
salus.updateTemperature(id, temperature);
```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.
