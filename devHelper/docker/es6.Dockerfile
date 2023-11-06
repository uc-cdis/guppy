# From https://gist.github.com/rluvaton/3a8d5953e1ad8236e8953c2e7691e5de

FROM ubuntu:bionic-20220531

# Must be root to install the packages
USER root

# Install required deps
RUN apt update
RUN apt -y install gnupg wget apt-transport-https coreutils java-common

# Import Elasticsearch GPG Key
RUN wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | apt-key add -

# Add Elasticsearch 6.x APT repository
# setting CPU architecture to be amd64 explicity as in case this is being built from ARM (which it should) it would find the elasticsearch package (elasticsearch 6.x doesn't have ARM binary)
RUN echo "deb [arch=amd64] https://artifacts.elastic.co/packages/6.x/apt stable main" | tee -a /etc/apt/sources.list.d/elastic-6.x.list

# update after elastic-search repo added
RUN apt-get update

# Install ARM Amazon JDK
RUN wget https://corretto.aws/downloads/latest/amazon-corretto-8-aarch64-linux-jdk.deb -O amazon-jdk.deb
RUN dpkg --skip-same-version -i amazon-jdk.deb
RUN rm amazon-jdk.deb

# Install Elasticsearch 6.x
RUN apt-get -y install elasticsearch

# the user was created when installed the elasticsearch
# Must not be root:
# org.elasticsearch.bootstrap.StartupException: java.lang.RuntimeException: can not run elasticsearch as root
USER elasticsearch

WORKDIR /usr/share/elasticsearch

# Append the custom conf

RUN echo "# ---------------------------------- CUSTOM -----------------------------------"                                    >> /etc/elasticsearch/elasticsearch.yml
RUN echo ""                                                                                                                   >> /etc/elasticsearch/elasticsearch.yml
RUN echo "# Added because of the following error (TL;DR: X-Pack features are not supported in ARM):"                          >> /etc/elasticsearch/elasticsearch.yml
RUN echo "# > org.elasticsearch.bootstrap.StartupException:"                                                                  >> /etc/elasticsearch/elasticsearch.yml
RUN echo "# >   ElasticsearchException[X-Pack is not supported and Machine Learning is not available for [linux-aarch64];"    >> /etc/elasticsearch/elasticsearch.yml
RUN echo "# >   you can use the other X-Pack features (unsupported) by setting xpack.ml.enabled: false in elasticsearch.yml]" >> /etc/elasticsearch/elasticsearch.yml
RUN echo "xpack.ml.enabled: false"                                                                                            >> /etc/elasticsearch/elasticsearch.yml
RUN echo ""                                                                                                                   >> /etc/elasticsearch/elasticsearch.yml
RUN echo "# Added because we want to listen to requests coming from computers in the network"                                 >> /etc/elasticsearch/elasticsearch.yml
RUN echo "network.host: 0.0.0.0"                                                                                              >> /etc/elasticsearch/elasticsearch.yml


ENTRYPOINT [ "./bin/elasticsearch" ]
