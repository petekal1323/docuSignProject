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
    let envelope = makeEnvelope(request.body.name, request.body.email, request.body.company);

    let results = await envelopesApi.createEnvelope(
        process.env.ACCOUNT_ID, {envelopeDefinition: envelope,});

    console.log("envelope results", results);

    let viewRequest = makeRecipientViewRequest(request.body.name, request.body.email, request.body.company);
    results = await envelopesApi.createRecipientView(process.env.ACCOUNT_ID, results.envelopeId, {
        recipientViewRequest: viewRequest});

    response.redirect(results.url);
    //console.log("view results", results);
});


function getEnvelopesApi(request) {
    let dsApiClient = new docusign.ApiClient();
    dsApiClient.setBasePath(process.env.BASE_PATH);
    dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + request.session.access_token);
    return new docusign.EnvelopesApi(dsApiClient);
};


function makeEnvelope(name, email, company) {
    let env = new docusign.EnvelopeDefinition();
    env.templateId = process.env.TEMPLATE_ID;
    let text = docusign.Text.constructFromObject({
        tabLabel: 'company_name', value: company,
    });

// Pull together the existing and new tabs in a Tabs object:
    let tabs = docusign.Tabs.constructFromObject({
        textTabs: [text]
    });

    let signer1 = docusign.TemplateRole.constructFromObject({
        email: email,
        name: name,
        tabs: tabs,
        clientUserId: process.env.CLIENT_USER_ID,
        roleName: 'Signer',
    });

    env.templateRoles = [signer1];
    env.status = 'sent';

    return env;
}

function makeRecipientViewRequest(name, email) {

    let viewRequest = new docusign.RecipientViewRequest();

    viewRequest.returnUrl = "http://localhost:8000/success";
    viewRequest.authenticationMethod = 'none';

    viewRequest.email = email;
    viewRequest.userName = name;
    viewRequest.clientUserId = process.env.CLIENT_USER_ID;

    return viewRequest;
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
    //response.send("Success");
    response.sendFile(path.join(__dirname, "success.html"));
});
// https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=5b4bdf98-3145-45b4-a419-6d25f877ec5b&redirect_uri=http://localhost:8000/

app.listen(8000, () => {
  console.log('Server is running on port: 8000', process.env.USER_ID);
});
