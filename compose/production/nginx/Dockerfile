FROM docker.io/nginx:1.27.5-alpine
COPY ./compose/production/nginx/default.conf /etc/nginx/conf.d/default.conf.template
CMD envsubst '${DEPLOY_PREFIX} ${CORS_ALLOWED_ORIGINS}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'