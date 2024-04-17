const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();
const docusign = require('docusign-esign');
const fs = require('fs');
const session = require('express-session');






const app = express();
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'dfsf94835asda',
    resave: true,
    saveUninitialized: true,

}));

app.post('/form', async (request, response) => {
    await checkToken(request);
        let envelopesApi = getEnvelopesApi(request);
        let envelope = makeEnvelope(request.body.name, request.body.email);

        let results = await envelopesApi.createEnvelope(
            process.env.ACCOUNT_ID, {envelopeDefinition: envelope,
        });
        console.log("envelope results", results);
        response.send("Form data recieved");
});


function getEnvelopesApi(request) {
    let dsApiClient = new docusign.ApiClient();
    dsApiClient.setBasePath(process.env.BASE_PATH);
    dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + request.session.access_token);
    return new docusign.EnvelopesApi(dsApiClient);
};




function makeEnvelope(name, email) {
    let env = new docusign.EnvelopeDefinition();
    env.templateId = process.env.TEMPLATE_ID;

    let signer1 = docusign.TemplateRole.constructFromObject({
        email: email,
        name: name,
        roleName: 'Signer',
    });

    env.templateRoles = [signer1];

    return env;
}








async function checkToken(request) {
    if (request.session.access_token && Date.now() < request.session.expires_at ) {
        console.log("reusing access token", request.session.access_token);
    } else{
        console.log("generating new access token");
        let dsApiClient = new docusign.ApiClient();
        dsApiClient.setBasePath(process.env.BASE_PATH);
        const results = await dsApiClient.requestJWTUserToken(
            process.env.INTEGRATION_KEY,
            process.env.USER_ID,
            "signature",
            fs.readFileSync(path.join(__dirname, "private.key")),
            3600
        );
        console.log(results.body);
        request.session.access_token = results.body.access_token;
        request.session.expires_at = Date.now() + (results.body.expires_in - 60) * 1000;
    }
}

app.get('/', async (request, response) => {
    await checkToken(request);
    response.sendFile(path.join(__dirname, "main.html"));
});


app.get("/success", (request, response) => {
    response.send("Success");
});
// https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=5b4bdf98-3145-45b4-a419-6d25f877ec5b&redirect_uri=http://localhost:8000/

app.listen(8000, () => {
  console.log('Server is running on port: 8000', process.env.USER_ID);
});
